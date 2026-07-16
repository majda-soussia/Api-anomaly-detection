// services/onesignal.service.js
const logger = require('../config/logger'); // adapte le chemin exact vers ton logger

async function sendAlertPush(alert) {
  try {
    logger.info({ alertId: alert.id, decision: alert.decision }, ' Sending OneSignal push...');


    const explanation = alert.explanation ?? {};
    const rootCause = explanation.root_cause;
    const reasons = explanation.reason ?? [];

    const bodyText = rootCause
      ? `${rootCause.method} ${rootCause.endpoint} — ${reasons[0] ?? 'cause identifiée'} (${rootCause.confidence}% confiance)`
      : `Server ${alert.server_id} — confidence ${Math.round(alert.confidence * 100)}% (cause non identifiée)`;

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        included_segments: ['Total Subscriptions'],
        headings: { en: `${alert.decision} — Serveur ${alert.server_id}` },
        contents: { en: bodyText },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error({ data }, ' OneSignal push failed');
    } else {
      logger.info({ full: data }, ' OneSignal push sent — full response');
    }

    return data;
  } catch (err) {
    logger.error({ err }, ' OneSignal push error');
    return null;
  }
}

module.exports = { sendAlertPush };