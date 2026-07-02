/**
 * app.js
 * --------
 * ISSUES IN THE ORIGINAL:
 *   - Two `console.log('...:', typeof metricsRoutes)` debug lines left in
 *     permanently — noise in every environment including production.
 *   - `cors()` with no options (open reflect-any-origin, credentials
 *     effectively unrestricted) — see middleware/security.js.
 *   - No helmet, no rate limiting, no request tracing, no 404 handler, no
 *     centralized error handler (Express's default HTML error page would
 *     have leaked stack traces to API clients).
 *
 * Middleware order matters and is deliberate:
 *   1. requestContext — every subsequent log line/response gets a request id
 *   2. helmet + cors — security headers and origin policy before anything
 *      touches the request
 *   3. generalLimiter — reject abusive traffic before it reaches JSON
 *      parsing or route logic
 *   4. express.json() — body parsing
 *   5. routes
 *   6. notFoundHandler — must come after all routes, catches unmatched paths
 *   7. errorHandler — must be last; Express identifies it as an error
 *      handler by its 4-argument signature
 */

const express = require('express');

const requestContext = require('./middleware/requestContext');
const { helmetMiddleware, corsMiddleware, generalLimiter } = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const metricsRoutes = require('./routes/metrics.routes');
const healthRoutes = require('./routes/health.routes');
const predictRoutes = require('./routes/predict.routes');
const alertsRoutes = require('./routes/alerts.routes');

const app = express();

app.use(requestContext);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(generalLimiter);
app.use(express.json({ limit: '1mb' }));

app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/alerts', alertsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
