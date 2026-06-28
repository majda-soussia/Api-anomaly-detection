const metricsService = require('../services/metrics.service');

function initMetricsEmitter(io, intervalMs = 2000) {

  setInterval(async () => {

    try {

      const metrics = await metricsService.getLatestMetrics();


      io.emit("metrics:update", metrics);

    } catch (err) {

      console.error("[MetricsEmitter] Erreur :", err.message);

    }

  }, intervalMs);

}

module.exports = { initMetricsEmitter };