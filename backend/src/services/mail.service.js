// src/services/mail.service.js
const transporter = require('../config/mail.config');

async function sendOtpEmail(toEmail, code) {
  const expiresMinutes = process.env.OTP_EXPIRES_MINUTES || 5;

  await transporter.sendMail({
    from: `"API Logs Monitoring" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Votre code de vérification',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; padding: 24px;">
        <h2>Code de vérification</h2>
        <p>Voici votre code à usage unique :</p>
        <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
          color: #4ec9b0; background: #f5f5f5; padding: 12px 24px;
          border-radius: 8px; display: inline-block;">${code}</p>
        <p>Ce code expire dans <strong>${expiresMinutes} minutes</strong>.</p>
        <p style="color: #888; font-size: 12px;">
          Si vous n'avez pas demandé ce code, ignorez cet email.
        </p>
      </div>
    `,
  });

  console.log(`[MailService] Code OTP envoyé à ${toEmail}`);
}

module.exports = { sendOtpEmail };