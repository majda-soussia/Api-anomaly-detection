// src/config/mail.config.js
// OneSignal est utilisé pour l'envoi des emails (OTP / 2FA)
// Il n'y a pas de "transporter" à instancier comme avec nodemailer —
// tout passe par l'API REST OneSignal avec une simple clé API.
// Ce fichier centralise juste la config OneSignal.

//const oneSignalConfig = {
//  appId: process.env.ONESIGNAL_APP_ID,
// apiKey: process.env.ONESIGNAL_API_KEY, // REST API Key (pas la User Auth Key)
//  apiUrl: 'https://api.onesignal.com/notifications',
//};

//module.exports = oneSignalConfig;
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,  // ton adresse gmail
    pass: process.env.SMTP_PASS,  // mot de passe d'application Gmail (pas ton vrai mdp)
  },
});
console.log("SMTP_USER =", process.env.SMTP_USER);
console.log("SMTP_PASS =", process.env.SMTP_PASS);
module.exports = transporter;