// src/services/auth.service.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const { generateOtp } = require('../utils/generateOtp');
const { sendOtpEmail } = require('./mail.service');

const SALT_ROUNDS = 10;
const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 5;

/**
 * ÉTAPE 1 : vérifie email + mot de passe.
 * Si correct, génère un code OTP, l'envoie par email,
 * et renvoie un "pending_token" temporaire (PAS un accès complet).
 */
async function login(email, password) {
  const user = await userModel.findUserByEmail(email);

  // Message volontairement générique : ne jamais révéler si c'est
  // l'email ou le mot de passe qui est incorrect (évite l'énumération de comptes)
  if (!user) {
    throw { status: 401, message: 'Email ou mot de passe incorrect.' };
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw { status: 401, message: 'Email ou mot de passe incorrect.' };
  }

  // Génère le code OTP et le stocke hashé (jamais en clair, même temporairement)
  const otpCode = generateOtp();
  const codeHash = await bcrypt.hash(otpCode, SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  await userModel.saveOtpCode({ userId: user.id, codeHash, expiresAt });
  await sendOtpEmail(user.email, otpCode);

  // Token temporaire : prouve "j'ai déjà passé l'étape 1", mais ne donne
  // AUCUN accès aux routes protégées. Durée de vie courte (10 min).
  const pendingToken = jwt.sign(
    { userId: user.id, step: 'pending_2fa' },
    process.env.PENDING_TOKEN_SECRET,
    { expiresIn: '10m' }
  );

  return { pendingToken };
}

/**
 * ÉTAPE 2 : vérifie le code OTP reçu par email.
 * Si correct, génère le VRAI JWT d'accès (avec le rôle inclus).
 */
async function verifyOtp(pendingToken, code) {
  let decoded;
  try {
    decoded = jwt.verify(pendingToken, process.env.PENDING_TOKEN_SECRET);
  } catch (err) {
    throw { status: 401, message: 'Session expirée, merci de vous reconnecter.' };
  }

  if (decoded.step !== 'pending_2fa') {
    throw { status: 401, message: 'Token invalide.' };
  }

  const otpRecord = await userModel.findValidOtp(decoded.userId);
  if (!otpRecord) {
    throw { status: 401, message: 'Code expiré ou introuvable. Merci de recommencer.' };
  }

  const codeMatches = await bcrypt.compare(code, otpRecord.code_hash);
  if (!codeMatches) {
    throw { status: 401, message: 'Code incorrect.' };
  }

  await userModel.markOtpAsUsed(otpRecord.id);

  const user = await userModel.findUserById(decoded.userId);

  // Le VRAI token d'accès — contient le rôle, utilisé par le middleware
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return {
    accessToken,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

/**
 * Création d'un compte (utilisé par le script create_admin.js,
 * ou par une route admin-only si tu veux permettre la création d'utilisateurs)
 */
async function registerUser(email, password, role = 'viewer') {
  const existing = await userModel.findUserByEmail(email);
  if (existing) {
    throw { status: 409, message: 'Un compte existe déjà avec cet email.' };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  return userModel.createUser({ email, passwordHash, role });
}

module.exports = { login, verifyOtp, registerUser };