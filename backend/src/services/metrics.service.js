const pool = require('../../config/db');

/**
 * Récupère les dernières métriques par serveur.
 * (server_id, timestamp, latency_ms, rps, cpu_usage, status)
 */
async function getLatestMetrics() {
  const query = `
    SELECT DISTINCT ON (server_id)
      server_id,
      timestamp,
      latency_ms,
      rps,
      cpu_usage,
      status
    FROM test_predictions
    ORDER BY server_id, timestamp DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
}

/**
 * Récupère un historique de métriques pour les graphes temps réel.
 * limitMinutes : fenêtre glissante (ex: dernières 15 minutes)
 */
async function getMetricsHistory(limitMinutes = 15) {
  const query = `
    SELECT
      server_id,
      timestamp,
      request_count,
      avg_response_time,
      anomaly_score
    FROM test_predictions
    WHERE timestamp >= NOW() - INTERVAL '${limitMinutes} minutes'
    ORDER BY timestamp ASC;
  `;
  const { rows } = await pool.query(query);
  return rows;
}

module.exports = { getLatestMetrics, getMetricsHistory };