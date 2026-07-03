// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const { loginController, verifyOtpController, registerController, adminCreateUserController } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.post('/login', loginController);
router.post('/verify-2fa', verifyOtpController);
router.post('/register', registerController);                                              // public
router.post('/admin/users', requireAuth, requireRole('admin'), adminCreateUserController); // admin only

module.exports = router;