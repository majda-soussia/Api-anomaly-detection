const db = require('../config/db');
const mlServiceClient = require('../utils/mlServiceClient');
const cache = require('../config/redis');
const { emitNewAlert } = require('../websocket/socket');
const env = require('../config/env');
const logger = require('../config/logger');

const ALERTS_CACHE_PREFIX = 'alerts:list:';

async function callMLService(features) {
  const { server_id, ...mlFeatures } = features;
  return mlServiceClient.predict(mlFeatures);
}

async function isInCooldown(decision, serverId) {
  const result = await db.query(
    `SELECT id FROM alerts
     WHERE decision = $1
       AND server_id = $2
       AND created_at > NOW() - make_interval(secs => $3::float / 1000)
     ORDER BY created_at DESC
     LIMIT 1`,
    [decision, serverId, env.ALERT_COOLDOWN_MS]
  );
  return result.rows.length > 0;
}

async function saveAlert(prediction, features) {
  const result = await db.query(
    `INSERT INTO alerts (
       decision, confidence,
       autoencoder_score, autoencoder_flag, autoencoder_threshold,
       isolation_forest_score, isolation_forest_flag,
       processing_time_ms, predicted_at,
       server_id, avg_response_time, error_rate_5xx,
       request_count, p95_response_time,
       status, created_at, raw_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active', NOW(), $15)
     RETURNING *`,
    [
      prediction.decision,
      prediction.confidence,
      prediction.autoencoder_score,
      prediction.autoencoder_flag,
      prediction.autoencoder_threshold,
      prediction.isolation_forest_score,
      prediction.isolation_forest_flag,
      prediction.processing_time_ms,
      prediction.timestamp,
      features.server_id ?? null,
      features.avg_response_time ?? null,
      features.error_rate_5xx ?? null,
      features.request_count ?? null,
      features.p95_response_time ?? null,
      JSON.stringify(features),
    ]
  );
  return result.rows[0];
}

/**
 * Pipeline: call ML service → decide → cooldown (per server+decision) →
 * persist → broadcast → invalidate list cache.
 */
async function predict(features) {
  const prediction = await callMLService(features);

  if (prediction.decision === 'NORMAL') {
    return { prediction, alert: null };
  }

  const inCooldown = await isInCooldown(prediction.decision, features.server_id);
  if (inCooldown) {
    logger.info(
      { decision: prediction.decision, serverId: features.server_id },
      'Alert suppressed by cooldown'
    );
    return { prediction, alert: null, cooldown: true };
  }

  const alert = await saveAlert(prediction, features);

  emitNewAlert(alert);
  await cache.invalidate(`${ALERTS_CACHE_PREFIX}*`);

  return { prediction, alert };
}

module.exports = { predict };
