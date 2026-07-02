// src/controllers/auth.controller.js
const authService = require('../services/auth.service');

async function loginController(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const { pendingToken } = await authService.login(email, password);

    return res.status(200).json({
      message: 'Code de vérification envoyé par email.',
      pendingToken,
    });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Erreur serveur.';
    if (status === 500) console.error('[AuthController] login error:', err);
    return res.status(status).json({ error: message });
  }
}

async function verifyOtpController(req, res) {
  try {
    const { pendingToken, code } = req.body;

    if (!pendingToken || !code) {
      return res.status(400).json({ error: 'Token et code requis.' });
    }

    const result = await authService.verifyOtp(pendingToken, code);

    return res.status(200).json({
      message: 'Connexion réussie.',
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Erreur serveur.';
    if (status === 500) console.error('[AuthController] verifyOtp error:', err);
    return res.status(status).json({ error: message });
  }
}
// À ajouter dans src/controllers/auth.controller.js
async function registerController(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error:
          'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    // Rôle toujours viewer pour l'inscription publique
    const user = await authService.registerUser(email, password, 'viewer');

    return res.status(201).json({
      message: 'Compte créé. Vous pouvez maintenant vous connecter.',
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Erreur serveur.';
    if (status === 500) console.error('[AuthController] register error:', err);
    return res.status(status).json({ error: message });
  }
}

// Route admin : créer un utilisateur avec rôle choisi
async function adminCreateUserController(req, res) {
  try {
    const { email, password, role } = req.body;
    const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;

            if (!passwordRegex.test(password)) {
            return res.status(400).json({
                error:
                'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character.'
            });
            }

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, mot de passe et rôle requis.' });
    }

    if (!['admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide. Valeurs acceptées : admin, viewer.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const user = await authService.registerUser(email, password, role);

    return res.status(201).json({
      message: 'Compte créé.',
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Erreur serveur.';
    if (status === 500) console.error('[AuthController] adminCreateUser error:', err);
    return res.status(status).json({ error: message });
  }
}

module.exports = { loginController, verifyOtpController, registerController, adminCreateUserController };
