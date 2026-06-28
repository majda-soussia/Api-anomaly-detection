/**
 * alerts.controller.js
 * --------------------
 * Contrôleurs pour :
 *   GET  /api/alerts               → liste des alertes
 *   POST /api/alerts/:id/acknowledge → acquitter une alerte
 */

const alertsService = require('../services/alerts.service');

/**
 * GET /api/alerts
 * Query params optionnels :
 *   - decision : 'CRITICAL' | 'WARNING'
 *   - status   : 'active' | 'acknowledged'
 *   - limit    : nombre d'alertes (défaut 50)
 *   - offset   : pagination (défaut 0)
 */
async function getAlerts(req, res) {
  try {
    const { decision, status, limit, offset } = req.query;

    // Validation des paramètres
    if (decision && !['CRITICAL', 'WARNING'].includes(decision)) {
      return res.status(400).json({
        error: "Paramètre 'decision' invalide. Valeurs acceptées : CRITICAL, WARNING.",
      });
    }

    if (status && !['active', 'acknowledged'].includes(status)) {
      return res.status(400).json({
        error: "Paramètre 'status' invalide. Valeurs acceptées : active, acknowledged.",
      });
    }

    const result = await alertsService.getAlerts({
      decision,
      status,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    return res.status(200).json({
      alerts: result.alerts,
      total: result.total,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  } catch (error) {
    console.error('[alerts.controller] getAlerts error:', error.message);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
}

/**
 * POST /api/alerts/:id/acknowledge
 * Marque une alerte comme traitée.
 */
async function acknowledgeAlert(req, res) {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "L'ID de l'alerte doit être un entier." });
    }

    const alert = await alertsService.acknowledgeAlert(id);

    if (!alert) {
      // Vérifier si l'alerte existe mais est déjà acquittée
      const existing = await alertsService.getAlertById(id);
      if (!existing) {
        return res.status(404).json({ error: `Alerte ${id} introuvable.` });
      }
      return res.status(409).json({
        error: `Alerte ${id} déjà acquittée.`,
        alert: existing,
      });
    }

    return res.status(200).json({
      message: `Alerte ${id} acquittée avec succès.`,
      alert,
    });
  } catch (error) {
    console.error('[alerts.controller] acknowledgeAlert error:', error.message);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
}

module.exports = { getAlerts, acknowledgeAlert };