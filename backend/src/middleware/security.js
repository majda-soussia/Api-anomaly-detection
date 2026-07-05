/**
 * middleware/security.js
 * ------------------------
 * ISSUES IN THE ORIGINAL app.js:
 *   - `app.use(cors())` with no options = reflects any Origin header,
 *     credentials effectively open. socket.config.js, written by the same
 *     team, correctly restricts origin — the REST API didn't.
 *   - No helmet at all (missing baseline headers: HSTS, X-Content-Type-Options,
 *     no clickjacking protection, etc.)
 *   - No rate limiting anywhere. POST /api/predict proxies to an ML
 *     service and writes to Postgres on every call — trivially abusable
 *     for a cost/DoS attack with zero limiting in front of it.
 *
 * Two rate limit tiers: a general one for the whole API, and a stricter one
 * specifically for /api/predict since it's the most expensive endpoint
 * (network hop to FastAPI + a DB write).
 */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { fail } = require('../utils/apiResponse');

const corsOptions = {
  origin: env.CLIENT_URL,
  methods: ['GET', 'POST'],
  credentials: true,
};

function rateLimitHandler(req, res) {
  fail(res, 429, 'Too many requests, please slow down.', 'RATE_LIMITED');
}

const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const predictLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.PREDICT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const writeLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = {
  helmetMiddleware: helmet(),
  corsMiddleware: cors(corsOptions),
  generalLimiter,
  predictLimiter,
  writeLimiter,
};
