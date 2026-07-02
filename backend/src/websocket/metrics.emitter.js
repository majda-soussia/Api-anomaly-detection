const metricsService = require('../services/metrics.service');
const logger = require('../config/logger');

let intervalHandle = null;

function initMetricsEmitter(io, intervalMs = 2000) {
  intervalHandle = setInterval(async () => {
    try {
      const metrics = await metricsService.getLatestMetrics();
      io.emit('metrics:update', metrics);
    } catch (err) {
      logger.error({ err: err.message }, '[MetricsEmitter] error');
    }
  }, intervalMs);
}

function stopMetricsEmitter() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { initMetricsEmitter, stopMetricsEmitter };