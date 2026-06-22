const express = require('express');
const cors = require('cors');

const metricsRoutes = require('./routes/metrics.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();
console.log('metricsRoutes:', typeof metricsRoutes);
console.log('healthRoutes:', typeof healthRoutes);console.log('metricsRoutes:', typeof metricsRoutes);
console.log('healthRoutes:', typeof healthRoutes);
app.use(cors());
app.use(express.json());

app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);

module.exports = app;