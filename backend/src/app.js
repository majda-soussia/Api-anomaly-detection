// src/app.js — ordre correct
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());


const requestContext = require('./middleware/requestContext');
const { helmetMiddleware, corsMiddleware, generalLimiter } = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const metricsRoutes = require('./routes/metrics.routes');
const healthRoutes = require('./routes/health.routes');
const predictRoutes = require('./routes/predict.routes');
const alertsRoutes = require('./routes/alerts.routes');
const authRoutes = require('./routes/auth.routes');


app.use(requestContext);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(generalLimiter);
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/alerts', alertsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
