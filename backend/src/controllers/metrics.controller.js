const metricsService = require('../services/metrics.service');

async function getMetrics(req, res) {
  try {
    const minutes = parseInt(req.query.minutes, 10);
    const safeMinutes = Number.isInteger(minutes) && minutes > 0 && minutes <= 1440
      ? minutes
      : 15;

    const [latest, history] = await Promise.all([
      metricsService.getLatestMetrics(),
      metricsService.getMetricsHistory(safeMinutes),
    ]);

    res.status(200).json({
      success: true,
      data: { latest, history },
      window_minutes: safeMinutes,
    });
  } catch (err) {
    console.error('Erreur GET /api/metrics:', err);
    res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les métriques',
    });
  }
}

module.exports = { getMetrics };