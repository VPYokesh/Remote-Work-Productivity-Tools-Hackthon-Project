const socket = io();

let currentRoom = null;
let localStream;
let peerConnections = {};

// DOM elements
const joinForm = document.getElementById('join-form');
const meetingRoom = document.getElementById('meeting-room');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomIdInput = document.getElementById('room-id-input');
const roomInfo = document.getElementById('room-info');
const roomIdDisplay = document.getElementById('room-id-display');
const inviteLink = document.getElementById('invite-link');
const videoArea = document.getElementById('video-area');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.querySelector('#chat-input input');
const sendButton = document.querySelector('#chat-input button');
const inviteButton = document.getElementById('invite-button');
const raiseHandBtn = document.getElementById('raise-hand-btn');
const pollBtn = document.getElementById('poll-btn');
const pollArea = document.getElementById('poll-area');
const submitPollBtn = document.getElementById('submit-poll');
const pollResults = document.getElementById('poll-results');

// WebRTC configuration
const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};

createRoomBtn.addEventListener('click', () => {
    socket.emit('create-room');
});

joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        joinRoom(roomId);
    } else {
        alert('Please enter a valid Room ID');
    }
});

socket.on('room-created', (roomId) => {
    currentRoom = roomId;
    showRoomInfo(roomId);
    setupLocalStream();
});

socket.on('room-joined', (roomId) => {
    currentRoom = roomId;
    showRoomInfo(roomId);
    setupLocalStream();
});

socket.on('room-not-found', () => {
    alert('Room not found. Please check the room ID and try again.');
});

function showRoomInfo(roomId) {
    joinForm.style.display = 'none';
    meetingRoom.style.display = 'flex';
    roomInfo.style.display = 'block';
    document.getElementById('chat-area').style.display = 'block'; // Add this line
    roomIdDisplay.textContent = roomId;
    
    const inviteUrl = `${window.location.origin}?room=${roomId}`;
    
    inviteButton.onclick = () => {
        navigator.clipboard.writeText(inviteUrl).then(() => {
            alert('Invite link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            prompt('Copy this link to invite others:', inviteUrl);
        });
    };
}

async function setupLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
        addVideoStream('local', localStream);
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
}

function addVideoStream(id, stream) {
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.id = `video-${id}`;
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    if (id === 'local') video.muted = true;
    videoContainer.appendChild(video);
    videoArea.appendChild(videoContainer);
}

function createPeerConnection(id) {
    const peerConnection = new RTCPeerConnection(configuration);
    peerConnections[id] = peerConnection;

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        addVideoStream(id, event.streams[0]);
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {to: id, candidate: event.candidate});
        }
    };

    return peerConnection;
}

socket.on('user-connected', async (userId) => {
    console.log('User connected:', userId);
    const peerConnection = createPeerConnection(userId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', {to: userId, offer: offer});
});

socket.on('offer', async ({from, offer}) => {
    console.log('Received offer from:', from);
    const peerConnection = createPeerConnection(from);
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', {to: from, answer: answer});
});

socket.on('answer', async ({from, answer}) => {
    console.log('Received answer from:', from);
    await peerConnections[from].setRemoteDescription(answer);
});

socket.on('ice-candidate', async ({from, candidate}) => {
    console.log('Received ICE candidate from:', from);
    await peerConnections[from].addIceCandidate(candidate);
});

socket.on('user-disconnected', (userId) => {
    console.log('User disconnected:', userId);
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
    }
    const videoContainer = document.getElementById(`video-${userId}`);
    if (videoContainer) videoContainer.remove();
});

// Chat functionality
sendButton.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message && currentRoom) {
        console.log('Sending message:', message);
        socket.emit('chat-message', currentRoom, message);
        addMessageToChat('You', message);
        chatInput.value = '';
    } else {
        console.log('Message not sent. Message:', message, 'CurrentRoom:', currentRoom);
    }
}

function addMessageToChat(sender, message) {
    console.log('Adding message to chat:', sender, message);
    const messageElement = document.createElement('div');
    messageElement.textContent = `${sender}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add this socket event listener for receiving chat messages
socket.on('chat-message', ({userId, message}) => {
    const sender = userId === socket.id ? 'You' : 'Other';
    addMessageToChat(sender, message);
});

// Check for room ID in URL when page loads
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) {
        joinRoom(roomId);
    }
});

function joinRoom(roomId) {
    socket.emit('join-room', roomId);
}

// Add this function to handle invitations
function inviteUser() {
    const inviteUrl = `${window.location.origin}?room=${currentRoom}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
        alert('Invite link copied to clipboard! Share this link with others to invite them to the meeting.');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        prompt('Copy this link to invite others:', inviteUrl);
    });
}

// Add event listener for invite button
inviteButton.addEventListener('click', inviteUser);

// Add event listener for raise hand button
raiseHandBtn.addEventListener('click', () => {
    socket.emit('raise-hand', currentRoom);
});

// Add event listener for poll button
pollBtn.addEventListener('click', () => {
    pollArea.style.display = pollArea.style.display === 'none' ? 'block' : 'none';
});

// Add event listener for submit poll button
submitPollBtn.addEventListener('click', () => {
    const question = document.getElementById('poll-question').value;
    const option1 = document.getElementById('poll-option1').value;
    const option2 = document.getElementById('poll-option2').value;
    if (question && option1 && option2) {
        socket.emit('create-poll', currentRoom, { question, options: [option1, option2] });
        pollArea.style.display = 'none';
    } else {
        alert('Please fill in all poll fields');
    }
});

// Add these socket event listeners
socket.on('hand-raised', (userId) => {
    addMessageToChat('System', `${userId} raised their hand`);
});

socket.on('new-poll', (pollData) => {
    const pollHtml = `
        <h4>${pollData.question}</h4>
        <button class="poll-option" data-option="0">${pollData.options[0]}</button>
        <button class="poll-option" data-option="1">${pollData.options[1]}</button>
    `;
    pollResults.innerHTML = pollHtml;
    pollResults.style.display = 'block';

    const optionButtons = pollResults.querySelectorAll('.poll-option');
    optionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const option = button.getAttribute('data-option');
            socket.emit('vote', currentRoom, option);
            optionButtons.forEach(btn => btn.disabled = true);
        });
    });
});

socket.on('poll-results', (results) => {
    const total = results.reduce((sum, count) => sum + count, 0);
    const percentages = results.map(count => ((count / total) * 100).toFixed(2));
    const resultsHtml = `
        <h4>Poll Results:</h4>
        <p>${percentages[0]}% voted for option 1</p>
        <p>${percentages[1]}% voted for option 2</p>
    `;
    pollResults.innerHTML += resultsHtml;
});