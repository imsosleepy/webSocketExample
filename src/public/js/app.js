const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");


const call = document.getElementById("call");

call.hidden = true;

let myStream;
let myPeerConnection;
let muted = false;
let cameraOff = false;
let roomName;
let myDataChannel;

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput')
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label === camera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        })
    } catch (e) {
        console.log(e);
    }
}

async function getMedia(deviceId) {
    const initailConstsraints = {
        audio: false,
        video: { facingMode: "user"},
    };

    const cameraConstraints = { audio : false, video: { deivceId: {exact : deviceId}}};
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstraints : initailConstsraints
        );
        myFace.srcObject = myStream;
        if(!deviceId){
            await getCameras();
        }
    } catch(e) {
        console.log(e);
    }
}

//getMedia();


function handleMuteClick() {
    myStream.getAudioTracks()
            .forEach(track => {track.enabled = !track.enabled});
    if(!muted){
        muteBtn.innerText = "Unmute";
        muted = true;
    } else {
        muteBtn.innerText = "Mute"
        muted = false;
    }
}
function handleCameraClick() {
    myStream.getVideoTracks()
    .forEach(track => {track.enabled = !track.enabled});
    if(cameraOff){
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    } else {
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value);
    if(myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find(sender => sender.track.kind ==="video");
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);


// welcome Form (join a room) 
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcomeForm.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value="";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket Code
socket.on("welcome", async () => {
    myDataChannel = myPeerConnection.createDataChannel("Chat");
    myDataChannel.addEventListener("message", console.log)
    console.log("made data channel");
    console.log("sent the offer");
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    socket.emit("offer", offer, roomName);
    
});

socket.on("offer", async (offer) => {
    myPeerConnection.addEventListener("datachannel", (event) => {
        myDataChannel = event.channel;
        myDataChannel.addEventListener("message", console.log);
    });
    console.log("recieved the offer");
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer");
});

socket.on("answer", async (answer) => {
    console.log("recieved the answer");
    myPeerConnection.setRemoteDescription(answer);
})

socket.on("ice", (ice) => {
    console.log("recieved candidate");
    myPeerConnection.addIceCandidate(ice);
})

// RTC code
function makeConnection() {
    myPeerConnection = new RTCPeerConnection();
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
    const peerFace = document.getElementById("peersFace");
    peerFace.srcObject = data.stream;
}