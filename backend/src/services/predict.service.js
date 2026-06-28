/**
 * predict.service.js
 * ------------------
 * Appelle le microservice FastAPI (Hybrid Autoencoder + Isolation Forest)
 * et sauvegarde l'alerte en base si la décision est CRITICAL ou WARNING.
 *
 * Cooldown : évite de créer plusieurs alertes identiques en moins de
 * COOLDOWN_MS millisecondes pour le même niveau de décision.
 */

const axios = require('axios');
const pool = require('../config/db');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001';
const COOLDOWN_MS = parseInt(process.env.ALERT_COOLDOWN_MS || '300000'); // 5 min par défaut

/**
 * Appelle POST /predict sur le microservice FastAPI.
 * @param {Object} features - Les 46 features de la fenêtre de 5 min
 * @returns {Object} Réponse complète du microservice
 */
async function callFastAPI(features) {
  const response = await axios.post(`${FASTAPI_URL}/predict`, features, {
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
}

/**
 * Vérifie si une alerte identique a été créée récemment (cooldown).
 * @param {string} decision - 'CRITICAL' ou 'WARNING'
 * @returns {boolean} true si on est encore dans le cooldown
 */
async function isInCooldown(decision) {
  const result = await pool.query(
    `SELECT id FROM alerts
     WHERE decision = $1
       AND created_at > NOW() - INTERVAL '${COOLDOWN_MS} milliseconds'
     ORDER BY created_at DESC
     LIMIT 1`,
    [decision]
  );
  return result.rows.length > 0;
}

/**
 * Sauvegarde une alerte en base PostgreSQL.
 * @param {Object} prediction - Résultat complet du microservice FastAPI
 * @returns {Object} L'alerte créée en base
 */
async function saveAlert(prediction) {
  const result = await pool.query(
    `INSERT INTO alerts (
       decision, confidence,
       autoencoder_score, autoencoder_flag, autoencoder_threshold,
       isolation_forest_score, isolation_forest_flag,
       processing_time_ms, predicted_at,
       status, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active', NOW())
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
    ]
  );
  return result.rows[0];
}

/**
 * Pipeline complet : appel FastAPI → décision → cooldown → sauvegarde.
 * @param {Object} features - Les 46 features
 * @returns {Object} { prediction, alert }
 */
async function predict(features) {
  // 1. Appel microservice ML
  const prediction = await callFastAPI(features);

  // 2. Si NORMAL → pas d'alerte
  if (prediction.decision === 'NORMAL') {
    return { prediction, alert: null };
  }

  // 3. Vérifier le cooldown
  const inCooldown = await isInCooldown(prediction.decision);
  if (inCooldown) {
    return { prediction, alert: null, cooldown: true };
  }

  // 4. Sauvegarder l'alerte
  const alert = await saveAlert(prediction);

  return { prediction, alert };
}

module.exports = { predict };