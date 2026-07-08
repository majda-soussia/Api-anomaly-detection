require('dotenv').config();

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const db = require('./config/db');
const cache = require('./config/redis');
const { initSocket, stopSocket } = require('./websocket/socket');
const { initMetricsEmitter, stopMetricsEmitter } = require('./websocket/metrics.emitter');
const httpServer = http.createServer(app);

const io = initSocket(httpServer);  
initMetricsEmitter(io);             
cache.init();

httpServer.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Node.js server started');
});

const SHUTDOWN_TIMEOUT_MS = 10000;

async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, closing gracefully');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    await new Promise((resolve) => httpServer.close(resolve));
    await stopSocket();
    await db.closePool();
    await cache.close();
    clearTimeout(forceExit);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
