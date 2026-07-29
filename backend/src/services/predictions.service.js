/**
 * Journal complet des prédictions (NORMAL inclus), contrairement à
 * alerts.service.js qui ne couvre que WARNING/CRITICAL. Lecture seule :
 * pas d'acknowledge, pas de status — ce n'est pas une liste d'actions,
 * juste un historique pour visualiser la tendance globale du pipeline.
 */

const db = require('../config/db');
const cache = require('../config/redis');

const PREDICTIONS_CACHE_PREFIX = 'predictions:list:';
const PREDICTIONS_CACHE_TTL_S = 10;

const SORT_COLUMNS = {
  created_at: 'created_at',
  decision: 'decision',
  confidence: 'confidence',
  server_id: 'server_id',
};

function buildCacheKey(filters) {
  return `${PREDICTIONS_CACHE_PREFIX}${JSON.stringify(filters)}`;
}

async function getPredictions(filters = {}) {
  const { decision, serverId, from, to, sort = 'created_at', order = 'desc', limit = 50, offset = 0 } = filters;

  const cacheKey = buildCacheKey(filters);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const conditions = [];
  const params = [];
  let i = 1;

  if (decision) {
    conditions.push(`decision = $${i++}`);
    params.push(decision);
  }
  if (serverId) {
    conditions.push(`server_id = $${i++}`);
    params.push(serverId);
  }
  if (from) {
    conditions.push(`created_at >= $${i++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`created_at <= $${i++}`);
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMNS[sort] || 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  const countResult = await db.query(`SELECT COUNT(*) FROM predictions_log ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await db.query(
    `SELECT * FROM predictions_log
     ${where}
     ORDER BY ${sortColumn} ${sortOrder}, id ${sortOrder}
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );

  const payload = { predictions: result.rows, total };
  await cache.set(cacheKey, payload, PREDICTIONS_CACHE_TTL_S);
  return payload;
}

/** Répartition des décisions sur une période — utile pour un petit résumé/graphique. */
async function getDecisionBreakdown(filters = {}) {
  const { serverId, from, to } = filters;
  const conditions = [];
  const params = [];
  let i = 1;

  if (serverId) {
    conditions.push(`server_id = $${i++}`);
    params.push(serverId);
  }
  if (from) {
    conditions.push(`created_at >= $${i++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`created_at <= $${i++}`);
    params.push(to);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT decision, COUNT(*) AS count FROM predictions_log ${where} GROUP BY decision`,
    params
  );
  return result.rows.reduce((acc, row) => {
    acc[row.decision] = parseInt(row.count, 10);
    return acc;
  }, { NORMAL: 0, WARNING: 0, CRITICAL: 0 });
}

module.exports = { getPredictions, getDecisionBreakdown };