/**
 * predict.controller.js
 * ---------------------
 * Contrôleur pour POST /api/predict
 *
 * Reçoit les 46 features, appelle predict.service,
 * et retourne la décision hybride + l'alerte créée (si applicable).
 */

const predictService = require('../services/predict.service');

/**
 * POST /api/predict
 * Body : { features: { request_count, avg_response_time, ... } }
 */
async function predict(req, res) {
  try {
    const features = req.body;

    if (!features || Object.keys(features).length === 0) {
      return res.status(400).json({
        error: 'Corps de requête vide. Les 46 features sont requises.',
      });
    }

    const result = await predictService.predict(features);

    return res.status(200).json({
      prediction: result.prediction,
      alert: result.alert || null,
      cooldown: result.cooldown || false,
      message: result.alert
        ? `Alerte ${result.prediction.decision} créée (id: ${result.alert.id})`
        : result.cooldown
        ? 'Alerte ignorée (cooldown actif)'
        : 'Aucune anomalie détectée',
    });
  } catch (error) {
    // Erreur de connexion au microservice FastAPI
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
      return res.status(503).json({
        error: 'Microservice ML indisponible. Vérifiez que FastAPI tourne sur le port 8001.',
      });
    }

    // Erreur de validation du microservice (features manquantes)
    if (error.response?.status === 422) {
      return res.status(422).json({
        error: 'Features invalides ou manquantes.',
        details: error.response.data,
      });
    }

    console.error('[predict.controller] Erreur inattendue:', error.message);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
}

module.exports = { predict };