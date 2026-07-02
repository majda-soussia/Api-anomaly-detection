// src/utils/generateOtp.js
const crypto = require('crypto');

/**
 * Génère un code OTP à 6 chiffres, cryptographiquement sûr
 * (pas Math.random() — pas assez aléatoire pour de la sécurité)
 */
function generateOtp() {
  // crypto.randomInt garantit une distribution uniforme et sûre
  const code = crypto.randomInt(100000, 999999).toString();
  return code;
}

module.exports = { generateOtp };