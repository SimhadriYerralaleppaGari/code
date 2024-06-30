const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let documents = {}; // In-memory document storage
let users = {};

io.on('connection', (socket) => {
  socket.on('join', ({ username, documentId }) => {
    if (!documents[documentId]) {
      documents[documentId] = '';
    }
    users[socket.id] = { username, documentId };
    socket.join(documentId);

    socket.emit('load-document', documents[documentId]);

    io.to(documentId).emit('user-joined', {
      username,
      users: Object.values(users).filter((user) => user.documentId === documentId)
    });

    socket.on('send-changes', (delta) => {
      socket.to(documentId).emit('receive-changes', delta);
      documents[documentId] = delta.data;
    });

    socket.on('cursor-move', ({ username, range }) => {
      socket.to(documentId).emit('cursor-move', { username, range });
    });

    socket.on('save-document', ({ documentId, data }) => {
      documents[documentId] = data;
    });

    socket.on('create-document', (newDocumentId) => {
      if (!documents[newDocumentId]) {
        documents[newDocumentId] = '';
      }
    });

    socket.on('delete-document', (deleteDocumentId) => {
      delete documents[deleteDocumentId];
      io.to(deleteDocumentId).emit('load-document', '');
    });

    socket.on('disconnect', () => {
      const { username, documentId } = users[socket.id];
      delete users[socket.id];
      io.to(documentId).emit('user-left', {
        username,
        users: Object.values(users).filter((user) => user.documentId === documentId)
      });
    });
  });
});

server.listen(4000, () => {
  console.log('Server listening on port 4000');
});

