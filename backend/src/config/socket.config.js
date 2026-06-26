// backend/src/config/socket.config.js
const socketConfig = {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173', // ← vérifie ce fallback aussi
    methods: ['GET', 'POST'],
    credentials: true,
  },
  metricsEmitInterval: parseInt(process.env.METRICS_EMIT_INTERVAL, 10) || 2000,
  transports: ['websocket', 'polling'],
};

module.exports = socketConfig;