const db = require('../config/db');
const mlServiceClient = require('../utils/mlServiceClient');
const cache = require('../config/redis');
const env = require('../config/env');
const logger = require('../config/logger');
const { sendAlertPush } = require('./onesignal.service');
const { analyzeEndpoints } = require('./endpointAnalyzer.service');

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

async function saveAlert(prediction, features, explanation) {
  const result = await db.query(
    `INSERT INTO alerts (
       decision, confidence,
       autoencoder_score, autoencoder_flag, autoencoder_threshold,
       isolation_forest_score, isolation_forest_flag,
       processing_time_ms, predicted_at,
       server_id, avg_response_time, error_rate_5xx,
       request_count, p95_response_time,
       status, created_at, raw_payload, explanation
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active', NOW(), $15, $16)
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
      JSON.stringify(explanation),
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

  // Fenêtre d'analyse : ancrée sur le dernier timestamp RÉELLEMENT disponible
  // dans access_logs pour ce serveur (pas l'heure système), car le dataset
  // est un rejeu de données historiques, pas du temps réel.
  let endpointAnalysis = { root_cause: null, reason: [], endpoints_analyzed: [] };
  try {
    if (features.timestamp) {
  const MARGIN_MS = 10 * 60 * 1000; // marge de 10 min autour du moment exact de la requête
  const center = new Date(features.timestamp);
  const windowStart = new Date(center.getTime() - MARGIN_MS);
  const windowEnd = new Date(center.getTime() + MARGIN_MS);
  endpointAnalysis = await analyzeEndpoints(features.server_id, windowStart, windowEnd);
      logger.info(
        { serverId: features.server_id, windowStart, windowEnd, endpoints: endpointAnalysis.endpoints_analyzed },
        'Endpoint analysis result (debug)'
      );
    } else {
      logger.warn({ serverId: features.server_id }, 'features.timestamp manquant : impossible d’aligner la fenêtre endpoint');
    }
  } catch (err) {
    logger.error({ err: err.message, serverId: features.server_id }, 'Endpoint analysis failed');
  }

  const explanation = {
    top_contributing_features: prediction.top_contributing_features ?? [],
    root_cause: endpointAnalysis.root_cause,
    reason: endpointAnalysis.reason,
  };

  const alert = await saveAlert(prediction, features, explanation);

  const { emitNewAlert } = require('../websocket/socket'); // lazy require — breaks the cycle
  emitNewAlert(alert);
  sendAlertPush(alert); // fire-and-forget push notification — don't await, don't let it block the pipeline
  await cache.invalidate(`${ALERTS_CACHE_PREFIX}*`);

  return { prediction, alert };
}

module.exports = { predict };