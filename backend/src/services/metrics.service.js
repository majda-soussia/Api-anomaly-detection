const pool = require('../../config/db');

/**
 * Récupère les dernières métriques par serveur.
 * Hypothèse de schéma : table `server_metrics`
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
    FROM server_metrics
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
    SELECT server_id, timestamp, latency_ms, rps
    FROM server_metrics
    WHERE timestamp >= NOW() - INTERVAL '${limitMinutes} minutes'
    ORDER BY timestamp ASC;
  `;
  const { rows } = await pool.query(query);
  return rows;
}

module.exports = { getLatestMetrics, getMetricsHistory };