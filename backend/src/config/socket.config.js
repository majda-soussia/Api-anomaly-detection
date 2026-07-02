const env = require('./env');

const socketConfig = {
  cors: {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  metricsEmitInterval: env.METRICS_EMIT_INTERVAL_MS,
  transports: ['websocket', 'polling'],
  pingInterval: 25000, // server pings client every 25s
  pingTimeout: 20000, // disconnect if no pong within 20s of a ping
};

module.exports = socketConfig;