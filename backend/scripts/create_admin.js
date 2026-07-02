// scripts/create_admin.js
// Usage : node scripts/create_admin.js admin@example.com MonMotDePasse123
require('dotenv').config();
const authService = require('../src/services/auth.service');

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error('Usage : node scripts/create_admin.js <email> <password>');
    process.exit(1);
  }

  try {
    const user = await authService.registerUser(email, password, 'admin');
    console.log(' Compte admin créé :', user);
    process.exit(0);
  } catch (err) {
    console.error('Erreur :', err.message || err);
    process.exit(1);
  }
}

main();