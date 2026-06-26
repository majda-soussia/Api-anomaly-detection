// src/websocket/socket.js
const { Server } = require('socket.io');
const { initMetricsEmitter } = require('./metrics.emitter');
const socketConfig = require('../config/socket.config');

let io = null;

/**
 * Initialise Socket.IO sur le serveur HTTP existant
 * @param {http.Server} httpServer - le serveur créé dans server.js
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: socketConfig.cors,
    transports: socketConfig.transports,
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connecté: ${socket.id}`);

    socket.on('subscribe:server', (serverId) => {
      socket.join(`server:${serverId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client déconnecté: ${socket.id}`);
    });
  });

  // Lance l'émission périodique des métriques
  initMetricsEmitter(io, socketConfig.metricsEmitInterval);

  return io;
}

/**
 * Permet d'accéder à l'instance io depuis n'importe où (ex: dans un controller)
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO non initialisé. Appelle initSocket(server) d\'abord.');
  }
  return io;
}

module.exports = { initSocket, getIO };