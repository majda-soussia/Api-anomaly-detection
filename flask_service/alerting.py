"""
alerting.py
-----------
Envoi d'alertes OneSignal quand le pipeline hybride détecte une anomalie
(CRITICAL ou WARNING). Isolé de predictor.py pour ne pas mélanger logique
ML et logique de notification.
"""

import logging
import os
import time

import requests

logger = logging.getLogger("alerting")

ONESIGNAL_APP_ID = os.getenv("ONESIGNAL_APP_ID")
ONESIGNAL_REST_API_KEY = os.getenv("ONESIGNAL_REST_API_KEY")
ONESIGNAL_URL = "https://onesignal.com/api/v1/notifications"

# Anti-spam : évite d'envoyer une notification à chaque requête si le
# système reste en anomalie plusieurs secondes/minutes d'affilée.
_ALERT_COOLDOWN_SECONDS = int(os.getenv("ALERT_COOLDOWN_SECONDS", "300"))  # 5 min par défaut
_last_alert_ts: dict[str, float] = {}


def _should_send(decision: str) -> bool:
    now = time.time()
    last = _last_alert_ts.get(decision, 0.0)
    if now - last < _ALERT_COOLDOWN_SECONDS:
        return False
    _last_alert_ts[decision] = now
    return True


def envoyer_alerte(decision: str, ae_score: float, if_score: float, confidence: float) -> None:
    """
    Envoie une notification OneSignal si decision est CRITICAL ou WARNING.
    N'envoie jamais pour NORMAL. Applique un cooldown pour éviter le spam.
    """
    if decision == "NORMAL":
        return

    if not ONESIGNAL_APP_ID or not ONESIGNAL_REST_API_KEY:
        logger.warning("ONESIGNAL_APP_ID/REST_API_KEY absents : alerte non envoyée.")
        return

    if not _should_send(decision):
        logger.info("Alerte '%s' ignorée (cooldown actif).", decision)
        return

    emoji = "🔴" if decision == "CRITICAL" else "🟠"
    payload = {
        "app_id": ONESIGNAL_APP_ID,
        "included_segments": ["Subscribed Users"],
        "headings": {"fr": f"{emoji} Anomalie détectée : {decision}"},
        "contents": {
            "fr": f"AE score={ae_score:.4f} | IF score={if_score:.4f} | confiance={confidence:.2f}"
        },
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Basic {ONESIGNAL_REST_API_KEY}",
    }

    try:
        r = requests.post(ONESIGNAL_URL, json=payload, headers=headers, timeout=5)
        r.raise_for_status()
        logger.info("Alerte OneSignal envoyée (%s) : %s", decision, r.json().get("id"))
    except requests.RequestException as exc:
        logger.error("Échec de l'envoi OneSignal : %s", exc)