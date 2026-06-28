/**
 * alerts.routes.js
 * ----------------
 * GET  /api/alerts                    → liste des alertes
 * POST /api/alerts/:id/acknowledge    → acquitter une alerte
 */

const express = require('express');
const router = express.Router();
const { getAlerts, acknowledgeAlert } = require('../controllers/alerts.controller');

router.get('/', getAlerts);
router.post('/:id/acknowledge', acknowledgeAlert);

module.exports = router;