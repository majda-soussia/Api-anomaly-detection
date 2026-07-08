const metricsService = require('../services/metrics.service');
const predictService = require('../services/predict.service');
const logger = require('../config/logger');

let intervalHandle = null;

function initMetricsEmitter(io, intervalMs = 2000) {
  intervalHandle = setInterval(async () => {
    try {
      const metrics = await metricsService.getLatestMetrics();
      io.emit('metrics:update', metrics);

      // Run each server's current tick through the real anomaly pipeline.
      // predict() itself handles cooldown, so this won't spam alerts every 2s.
      await Promise.all(
        metrics.map((row) =>
          predictService
            .predict({
              server_id: row.server_id,
              avg_response_time: row.avg_response_time,
              error_rate_5xx: row.error_rate_5xx,
              request_count: row.request_count,
              p95_response_time: row.p95_response_time,
            })
            .catch((err) => {
              logger.error(
                { err: err.message, serverId: row.server_id },
                '[MetricsEmitter] predict() failed'
              );
            })
        )
      );
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
