/**
 * predict.routes.js
 * -----------------
 * POST /api/predict → exécute le pipeline hybride ML
 */

const express = require('express');
const router = express.Router();
const { predict } = require('../controllers/predict.controller');

router.post('/', predict);

module.exports = router;