/**
 * middleware/requestContext.js
 * ------------------------------
 * Attaches a correlation ID to every request (from the incoming
 * X-Request-Id header if a gateway/load balancer already set one, otherwise
 * generates one) and a request-scoped child logger. Every log line for a
 * given request can then be grepped by ID across the whole call stack —
 * essential once Personne A's metrics emitter, your predict/alerts flow,
 * and the FastAPI call are all logging concurrently.
 */

const { randomUUID } = require('crypto');
const logger = require('../config/logger');

function requestContext(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  req.log = logger.child({ requestId: req.id, method: req.method, path: req.originalUrl });

  const start = Date.now();
  res.on('finish', () => {
    req.log.info({ statusCode: res.statusCode, durationMs: Date.now() - start }, 'request completed');
  });

  next();
}

module.exports = requestContext;
