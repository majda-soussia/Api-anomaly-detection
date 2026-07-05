/**
 * services/alerts.service.js
 * ------------------------------
 * CHANGES FROM THE ORIGINAL:
 *   1. Filtering expanded: `server_id` and a `from`/`to` date range were
 *      requested by the briefing (5.1: "Filtres : niveau, date, server_id,
 *      endpoint") but never implemented — only decision/status existed.
 *   2. Sorting added (`sort`/`order`), validated against an allow-list in
 *      validators/alerts.validator.js — never interpolate a column/order
 *      name from user input directly into SQL, even via a loosely-checked
 *      whitelist; here it's a strict zod enum, so only four exact strings
 *      can ever reach the query.
 *   3. Cache-aside read for the list endpoint (short 10s TTL — alerts are
 *      latency-sensitive but a 10s staleness window is an acceptable trade
 *      for cutting DB load on a page that auto-refreshes). Cache key
 *      includes every filter param so different filter combinations don't
 *      collide. Falls back transparently to Postgres if Redis is disabled
 *      or down (see config/redis.js).
 *   4. `acknowledgeAlert` now accepts and stores `acknowledgedBy` (the
 *      briefing requires recording "qui a acquitté" — the original never
 *      captured this). Still optional since there's no auth system yet.
 *   5. Cache invalidated on every write (acknowledge), in addition to the
 *      invalidation already added in predict.service.js for new alerts.
 *   6. New `getMttrSeconds` for the History page MTTR stat requested in the
 *      briefing but never implemented.
 */

const db = require('../config/db');
const cache = require('../config/redis');

const ALERTS_CACHE_PREFIX = 'alerts:list:';
const ALERTS_CACHE_TTL_S = 10;

const SORT_COLUMNS = {
  created_at: 'created_at',
  decision: 'decision',
  confidence: 'confidence',
  server_id: 'server_id',
};

function buildCacheKey(filters) {
  return `${ALERTS_CACHE_PREFIX}${JSON.stringify(filters)}`;
}

async function getAlerts(filters = {}) {
  const { decision, status, serverId, from, to, sort = 'created_at', order = 'desc', limit = 50, offset = 0 } = filters;

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
  if (status) {
    conditions.push(`status = $${i++}`);
    params.push(status);
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

  const countResult = await db.query(`SELECT COUNT(*) FROM alerts ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await db.query(
    `SELECT * FROM alerts
     ${where}
     ORDER BY ${sortColumn} ${sortOrder}, id ${sortOrder}
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );

  const payload = { alerts: result.rows, total };
  await cache.set(cacheKey, payload, ALERTS_CACHE_TTL_S);
  return payload;
}

async function acknowledgeAlert(id, acknowledgedBy) {
  const result = await db.query(
    `UPDATE alerts
     SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $2
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [id, acknowledgedBy ?? null]
  );

  if (result.rows.length === 0) return null;

  await cache.invalidate(`${ALERTS_CACHE_PREFIX}*`);
  return result.rows[0];
}

async function getAlertById(id) {
  const result = await db.query('SELECT * FROM alerts WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/** MTTR (mean time to resolve), in seconds, over acknowledged alerts in range. */
async function getMttrSeconds(filters = {}) {
  const { from, to, serverId } = filters;
  const conditions = [`status = 'acknowledged'`, `acknowledged_at IS NOT NULL`];
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

  const result = await db.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at))) AS mttr_seconds
     FROM alerts WHERE ${conditions.join(' AND ')}`,
    params
  );

  return result.rows[0].mttr_seconds !== null ? parseFloat(result.rows[0].mttr_seconds) : null;
}

module.exports = { getAlerts, acknowledgeAlert, getAlertById, getMttrSeconds };
