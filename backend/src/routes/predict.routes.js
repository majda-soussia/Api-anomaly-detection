/**
 * routes/predict.routes.js
 * POST /api/predict → validated body, then the hybrid ML pipeline
 */

const express = require('express');
const router = express.Router();
const { predict } = require('../controllers/predict.controller');
const validate = require('../middleware/validate');
const { predictBodySchema } = require('../validators/predict.validator');
const { predictLimiter } = require('../middleware/security');

router.post('/', predictLimiter, validate(predictBodySchema, 'body'), predict);

module.exports = router;
