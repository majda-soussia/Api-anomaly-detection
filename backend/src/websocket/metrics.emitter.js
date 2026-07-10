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
      metrics.map((row) => {
        const { timestamp, anomaly_score, is_anomaly, status, y_true_eval_only, ...mlFeatures } = row;
        return predictService
          .predict(mlFeatures) // contient server_id + les 46 features ML
          .catch((err) => {
            logger.error(
              { err: err.message, serverId: row.server_id },
              '[MetricsEmitter] predict() failed'
            );
          });
      })
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
