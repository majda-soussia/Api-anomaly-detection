/**
 * alerts.service.js
 * -----------------
 * Logique métier pour la gestion des alertes :
 *   - Lister les alertes avec filtres
 *   - Acquitter une alerte (acknowledge)
 */

const pool = require('../config/db');

/**
 * Récupère la liste des alertes avec filtres optionnels.
 * @param {Object} filters - { decision, status, limit, offset }
 * @returns {Object} { alerts, total }
 */
async function getAlerts({ decision, status, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (decision) {
    conditions.push(`decision = $${paramIndex++}`);
    params.push(decision);
  }

  if (status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total pour pagination
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM alerts ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Alertes paginées
  const result = await pool.query(
    `SELECT * FROM alerts
     ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return { alerts: result.rows, total };
}

/**
 * Acquitte une alerte — passe son statut de 'active' à 'acknowledged'.
 * @param {number} id - ID de l'alerte
 * @returns {Object|null} L'alerte mise à jour, ou null si inexistante
 */
async function acknowledgeAlert(id) {
  const result = await pool.query(
    `UPDATE alerts
     SET status = 'acknowledged', acknowledged_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Récupère une alerte par son ID.
 * @param {number} id
 * @returns {Object|null}
 */
async function getAlertById(id) {
  const result = await pool.query(
    'SELECT * FROM alerts WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAlerts, acknowledgeAlert, getAlertById };