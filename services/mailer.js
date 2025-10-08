// services/mailer.js
import nodemailer from 'nodemailer';

// Import Resend se disponibile
let ResendClient = null;
let resend = null;
try {
  ({ Resend: ResendClient } = await import('resend'));
  if (process.env.RESEND_API_KEY) {
    resend = new ResendClient(process.env.RESEND_API_KEY);
  }
} catch (e) {
  console.warn('Resend non disponibile:', e.message || e);
}

// Configurazione trasporto SMTP con logging / debug esteso
const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtps.aruba.it',
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.MAILER_PASS,
  },
  logger: true,   // log base
  debug: true,    // log dettagliato delle comunicazioni SMTP
  connectionTimeout: 30000,
  greetingTimeout: 20000,
  socketTimeout: 30000,
  tls: {
    rejectUnauthorized: false,  // per debug (SSL non verificato)
  },
});

// Variabili mittente
const FROM_NAME  = process.env.FROM_NAME || 'Melorosso';
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;
// Mittente fallback per Resend se dominio non verificato
const RESEND_FROM = process.env.RESEND_FROM || 'mailer@resend.dev';

export async function sendMail({ to, cc, bcc, subject, text, html, replyTo }) {
  const envelopeTo = []
    .concat(to || [])
    .concat(cc || [])
    .concat(bcc || []);
  const mailFrom = `"${FROM_NAME}" <${FROM_EMAIL}>`;

  // Primo tentativo: SMTP
  try {
    const info = await smtpTransport.sendMail({
      from: mailFrom,
      to, cc, bcc, subject, text, html, replyTo,
      envelope: { from: FROM_EMAIL, to: envelopeTo },
      dsn: {
        id: 'dsn-' + Date.now(),
        return: 'headers',
        notify: ['failure', 'delay'],
        recipient: process.env.SMTP_USER,
      },
    });

    console.log('[SMTP] ✅ Invio OK');
    console.log('[SMTP] messageId:', info.messageId);
    console.log('[SMTP] accepted:', info.accepted);
    console.log('[SMTP] rejected:', info.rejected);
    console.log('[SMTP] response:', info.response);
    console.log('[SMTP] envelope:', info.envelope);
    return info;
  } catch (err) {
    console.error('[SMTP] ❌ Errore invio:', err.code || err.message || err);
    const isTimeout = err.code === 'ETIMEDOUT' || (err.message || '').toLowerCase().includes('timeout');

    // Se è un timeout e Resend è disponibile, fai fallback
    if (isTimeout && resend) {
      console.log('[RESEND] Attivo fallback da SMTP a Resend per timeout...');
      const r = await resend.emails.send({
        from: `${FROM_NAME} <${RESEND_FROM}>`,
        to,
        cc,
        bcc,
        reply_to: replyTo,
        subject,
        html,
        text,
      });
      console.log('[RESEND] ✅ Inviato via Resend, id:', r.id);
      return r;
    }

    // Altrimenti rilancia errore
    throw err;
  }
}