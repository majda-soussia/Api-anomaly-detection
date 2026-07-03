// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');

/**
 * Vérifie que la requête contient un JWT valide.
 * Si oui, attache req.user = { userId, email, role } pour les middlewares suivants.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, email, role, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

module.exports = { requireAuth };