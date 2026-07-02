// src/routes/metrics.routes.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const { getMetrics } = require('../controllers/metrics.controller');

router.get('/', requireAuth, getMetrics);

module.exports = router;