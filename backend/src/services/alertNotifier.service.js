// services/alertNotifier.service.js
const logger = require('../config/logger'); // adapte le chemin si besoin
const { sendAlertPush } = require('./onesignal.service');

/**
 * Envoie la notification push (navigateur) pour une alerte, en fire-and-forget.
 * Ne doit jamais faire planter le flux principal de création d'alerte.
 */
async function notifyAlert(alert) {
  try {
    await sendAlertPush(alert);
  } catch (err) {
    logger.error({ err, alertId: alert.id }, 'Push notification failed');
  }
}

module.exports = { notifyAlert };