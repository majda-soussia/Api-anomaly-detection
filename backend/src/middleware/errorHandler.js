/**
 * middleware/errorHandler.js
 * -----------------------------
 * BEFORE: every controller had its own try/catch translating errors to
 * status codes (predict.controller.js alone had three separate branches for
 * ECONNREFUSED / 422 / generic). That logic gets copy-pasted into every new
 * controller and drifts out of sync.
 *
 * AFTER: controllers/services throw (AppError, axios errors, zod errors,
 * pg errors, or anything else) and this single place maps them to a
 * response. New error types get handled in one location, not N.
 */

const { ZodError } = require('zod');
const AppError = require('../utils/AppError');
const { fail } = require('../utils/apiResponse');
const env = require('../config/env');

function notFoundHandler(req, res) {
  return fail(res, 404, `Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const log = req.log || require('../config/logger');

  // 1) Errors we threw deliberately
  if (err instanceof AppError) {
    log.warn({ err: err.message, code: err.code }, 'Operational error');
    return fail(res, err.statusCode, err.message, err.code);
  }

  // 2) Validation errors from zod
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return fail(res, 400, message, 'VALIDATION_ERROR');
  }

  // 3) Errors surfaced from the ML service HTTP client (axios + circuit breaker)
  if (err.isAxiosError || err.code === 'EOPENBREAKER') {
    if (err.code === 'ECONNABORTED' || err.code === 'EOPENBREAKER') {
      return fail(res, 503, 'ML service is unavailable or timed out.', 'ML_SERVICE_UNAVAILABLE');
    }
    if (err.response?.status === 422) {
      return fail(res, 422, 'ML service rejected the payload (invalid features).', 'ML_VALIDATION_ERROR');
    }
    if (err.code === 'ECONNREFUSED') {
      return fail(res, 503, 'ML service connection refused.', 'ML_SERVICE_UNAVAILABLE');
    }
  }

  // 4) PostgreSQL errors — map the common, expected ones; let the rest fall through as 500
  if (err.code === '23505') {
    return fail(res, 409, 'Duplicate record.', 'DB_CONFLICT');
  }
  if (err.code === '23503') {
    return fail(res, 400, 'Referenced record does not exist.', 'DB_FOREIGN_KEY_VIOLATION');
  }

  // 5) Anything else is a bug — log full detail server-side, never leak it to the client
  log.error({ err }, 'Unhandled error');
  const message = env.NODE_ENV === 'production' ? 'Internal server error.' : err.message;
  return fail(res, 500, message, 'INTERNAL_ERROR');
}

module.exports = { errorHandler, notFoundHandler };
