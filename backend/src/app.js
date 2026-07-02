// src/app.js — ordre correct
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const metricsRoutes = require('./routes/metrics.routes');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');

app.use('/api/auth', authRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);

module.exports = app;