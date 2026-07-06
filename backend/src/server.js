/**
 * server.js
 * -----------
 * ISSUES IN THE ORIGINAL:
 *   - No graceful shutdown. On SIGTERM (e.g. `docker stop`, k8s pod
 *     eviction, PM2 restart) the process died immediately: in-flight HTTP
 *     requests get cut off mid-response, the metrics emitter interval
 *     throws against a pool that may already be gone, and Postgres/Redis
 *     connections aren't closed cleanly.
 *   - No handling of uncaughtException / unhandledRejection — either of
 *     those crashes the process with a raw stack trace and no structured
 *     log entry.
 *
 * Now: on SIGTERM/SIGINT, stop accepting new connections, close the
 * WebSocket layer (and its interval), close the DB pool and Redis client,
 * then exit — with a hard timeout so a stuck connection can't block
 * deployment forever.
 */

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const db = require('./config/db');
const cache = require('./config/redis');
const { initSocket, stopSocket } = require('./websocket/socket');

const httpServer = http.createServer(app);

initSocket(httpServer);
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
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});
