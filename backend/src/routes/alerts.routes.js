/**
 * routes/alerts.routes.js
 * GET  /api/alerts              → list, validated/coerced filters + sorting
 * GET  /api/alerts/mttr         → mean time to resolve stat (History page)
 * POST /api/alerts/:id/acknowledge → acknowledge, validated id + body
 */

const express = require('express');
const router = express.Router();
const { getAlerts, acknowledgeAlert, getMttr } = require('../controllers/alerts.controller');
const validate = require('../middleware/validate');
const { listAlertsQuerySchema, alertIdParamSchema, acknowledgeBodySchema } = require('../validators/alerts.validator');
const { writeLimiter } = require('../middleware/security');

router.get('/', validate(listAlertsQuerySchema, 'query'), getAlerts);
router.get('/mttr', validate(listAlertsQuerySchema, 'query'), getMttr);
router.post(
  '/:id/acknowledge',
  writeLimiter,
  validate(alertIdParamSchema, 'params'),
  validate(acknowledgeBodySchema, 'body'),
  acknowledgeAlert
);

module.exports = router;
