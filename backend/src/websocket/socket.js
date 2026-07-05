const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const socketConfig = require("../config/socket.config");
const { initMetricsEmitter, stopMetricsEmitter } = require("./metrics.emitter");
const logger = require("../config/logger");

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: socketConfig.cors,
    transports: socketConfig.transports,

    pingInterval: socketConfig.pingInterval,
    pingTimeout: socketConfig.pingTimeout,
    maxHttpBufferSize: 1e6,

    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
    },
  });

  // Auth JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentification requise."));
    }

    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error("Token invalide ou expiré."));
    }
  });

  io.on("connection", (socket) => {
    logger.info(
      {
        socketId: socket.id,
        user: socket.user.email,
        role: socket.user.role,
      },
      "WebSocket client connected"
    );

    socket.on("subscribe:server", (serverId) => {
      socket.join(`server:${serverId}`);
    });

    socket.on("unsubscribe:server", (serverId) => {
      socket.leave(`server:${serverId}`);
    });

    socket.on("disconnect", (reason) => {
      logger.info(
        { socketId: socket.id, reason },
        "WebSocket client disconnected"
      );
    });

    socket.on("error", (err) => {
      logger.warn(
        { socketId: socket.id, err: err.message },
        "WebSocket socket error"
      );
    });
  });

  initMetricsEmitter(io, socketConfig.metricsEmitInterval);

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.IO not initialized.");
  }
  return io;
}

function emitNewAlert(alert) {
  if (!io) return;

  io.emit("alert:new", alert);

  if (alert.server_id) {
    io.to(`server:${alert.server_id}`).emit("alert:new", alert);
  }
}

async function stopSocket() {
  stopMetricsEmitter();

  if (io) {
    await new Promise((resolve) => io.close(resolve));
  }
}

module.exports = {
  initSocket,
  getIO,
  emitNewAlert,
  stopSocket,
};