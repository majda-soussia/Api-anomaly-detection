/**
 * GET /api/predictions          → journal complet (NORMAL inclus), lecture seule
 * GET /api/predictions/breakdown → répartition NORMAL/WARNING/CRITICAL sur une période
 */

const express = require('express');
const router = express.Router();
const { getPredictions, getBreakdown } = require('../controllers/predictions.controller');
const validate = require('../middleware/validate');
const { listPredictionsQuerySchema } = require('../validators/predictions.validator');

router.get('/', validate(listPredictionsQuerySchema, 'query'), getPredictions);
router.get('/breakdown', validate(listPredictionsQuerySchema, 'query'), getBreakdown);

module.exports = router;