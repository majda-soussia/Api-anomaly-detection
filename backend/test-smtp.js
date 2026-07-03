require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('USER:', JSON.stringify(process.env.SMTP_USER));
console.log('PASS:', JSON.stringify(process.env.SMTP_PASS));
console.log('PASS longueur:', process.env.SMTP_PASS?.length);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((err, success) => {
  if (err) {
    console.log('❌ Échec:', err.message);
  } else {
    console.log('✅ SMTP OK');
  }
});