const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('create-room', () => {
        console.log('Create room request received');
        const roomId = uuidv4();
        rooms.set(roomId, { users: new Set(), whiteboard: null });
        socket.join(roomId);
        console.log('Room created:', roomId);
        socket.emit('room-created', roomId);
    });

    socket.on('join-room', (roomId) => {
        if (rooms.has(roomId)) {
            socket.join(roomId);
            rooms.get(roomId).users.add(socket.id);
            socket.emit('room-joined', roomId);
            socket.to(roomId).emit('user-connected', socket.id);
            
            const whiteboardState = rooms.get(roomId).whiteboard;
            if (whiteboardState) {
                socket.emit('whiteboard-state', whiteboardState);
            }
        } else {
            socket.emit('room-not-found');
        }
    });

    socket.on('offer', ({ to, offer }) => {
        socket.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }) => {
        socket.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
        socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    socket.on('draw', (roomId, data) => {
        socket.to(roomId).emit('draw', data);
        if (rooms.has(roomId)) {
            rooms.get(roomId).whiteboard = data;
        }
    });

    socket.on('clear-whiteboard', (roomId) => {
        socket.to(roomId).emit('clear-whiteboard');
        if (rooms.has(roomId)) {
            rooms.get(roomId).whiteboard = null;
        }
    });

    socket.on('chat-message', (roomId, message) => {
        console.log('Received chat message:', roomId, message);
        io.to(roomId).emit('chat-message', { userId: socket.id, message });
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        for (const [roomId, room] of rooms.entries()) {
            if (room.users.has(socket.id)) {
                room.users.delete(socket.id);
                socket.to(roomId).emit('user-disconnected', socket.id);
                if (room.users.size === 0) {
                    rooms.delete(roomId);
                }
                break;
            }
        }
    });

    socket.on('raise-hand', (roomId) => {
        socket.to(roomId).emit('hand-raised', socket.id);
    });

    socket.on('create-poll', (roomId, pollData) => {
        io.to(roomId).emit('new-poll', pollData);
    });

    socket.on('vote', (roomId, option) => {
        const results = [0, 0];
        results[option]++;
        io.to(roomId).emit('poll-results', results);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));