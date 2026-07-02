// src/middlewares/role.middleware.js
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Accès refusé : permissions insuffisantes.',
      });
    }

    next();
  };
}

module.exports = { requireRole };