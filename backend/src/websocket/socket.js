// backend/src/websocket/socket.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const socketConfig = require('../config/socket.config');
const { initMetricsEmitter } = require('./metrics.emitter');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: socketConfig.cors,
    transports: socketConfig.transports,
  });

  // Middleware Socket.IO : vérifie le JWT AVANT d'accepter la connexion
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentification requise.'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // accessible plus tard via socket.user.role, etc.
      next();
    } catch (err) {
      return next(new Error('Token invalide ou expiré.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connecté: ${socket.id} (${socket.user.email}, role: ${socket.user.role})`);

    socket.on('subscribe:server', (serverId) => {
      socket.join(`server:${serverId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client déconnecté: ${socket.id}`);
    });
  });

  initMetricsEmitter(io, socketConfig.metricsEmitInterval);

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO non initialisé.');
  return io;
}

module.exports = { initSocket, getIO };