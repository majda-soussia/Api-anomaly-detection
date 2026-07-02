// src/services/mail.service.js
const oneSignalConfig = require('../config/mail.config');

async function sendOtpEmail(toEmail, code) {
  const expiresMinutes = process.env.OTP_EXPIRES_MINUTES || 5;

  const payload = {
    app_id: oneSignalConfig.appId,
    name: '2FA OTP Code',
    email_subject: 'Votre code de vérification',
    email_body: `
      <div style="font-family: sans-serif; max-width: 480px; padding: 24px;">
        <h2>Code de vérification</h2>
        <p>Voici votre code à usage unique pour vous connecter :</p>
        <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
          color: #4ec9b0; background: #f5f5f5; padding: 12px 24px;
          border-radius: 8px; display: inline-block;">${code}</p>
        <p>Ce code expire dans <strong>${expiresMinutes} minutes</strong>.</p>
        <p style="color: #888; font-size: 12px;">
          Si vous n'avez pas demandé ce code, ignorez cet email.
        </p>
      </div>
    `,
    include_email_tokens: [toEmail],
    include_unsubscribed: true,  // ← c'était ça qui manquait
  };

  const response = await fetch(oneSignalConfig.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${oneSignalConfig.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || data.errors) {
    console.error('[MailService] Erreur OneSignal:', JSON.stringify(data.errors || data));
    throw new Error("Echec de l'envoi du code par email.");
  }

  console.log(`[MailService] Code OTP envoye a ${toEmail} (id: ${data.id})`);
  return data;
}

module.exports = { sendOtpEmail };