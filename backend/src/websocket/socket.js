const { Server } = require('socket.io');
const { initMetricsEmitter, stopMetricsEmitter } = require('./metrics.emitter');
const socketConfig = require('../config/socket.config');
const logger = require('../config/logger');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: socketConfig.cors,
    transports: socketConfig.transports,
    pingInterval: socketConfig.pingInterval,
    pingTimeout: socketConfig.pingTimeout,
    maxHttpBufferSize: 1e6, // 1MB — these are small metric payloads, no reason to allow more
    connectionStateRecovery: {
      // Lets a client that briefly disconnects (e.g. tab backgrounded) resume
      // its room memberships and miss as few events as possible, instead of
      // starting from a blank slate on every reconnect.
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
  });

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'WebSocket client connected');

    socket.on('subscribe:server', (serverId) => {
      socket.join(`server:${serverId}`);
    });

    socket.on('unsubscribe:server', (serverId) => {
      socket.leave(`server:${serverId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'WebSocket client disconnected');
    });

    socket.on('error', (err) => {
      logger.warn({ socketId: socket.id, err: err.message }, 'WebSocket socket error');
    });
  });

  initMetricsEmitter(io, socketConfig.metricsEmitInterval);

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initSocket(server) first.");
  }
  return io;
}

/** Broadcast a newly created alert to every connected dashboard client. */
function emitNewAlert(alert) {
  if (!io) return; // socket layer may not be up yet (e.g. during tests) — don't crash the caller
  io.emit('alert:new', alert);
  if (alert.server_id) {
    io.to(`server:${alert.server_id}`).emit('alert:new', alert);
  }
}

/** Called from server.js during graceful shutdown. */
async function stopSocket() {
  stopMetricsEmitter();
  if (io) {
    await new Promise((resolve) => io.close(resolve));
  }
}

module.exports = { initSocket, getIO, emitNewAlert, stopSocket };
