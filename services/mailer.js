// services/mailer.js
import nodemailer from 'nodemailer';

// Import “lazy” di Resend (così non esplode se non lo installi in dev)
let ResendClient = null;
let resend = null;
try {
  ({ Resend: ResendClient } = await import('resend'));
  if (process.env.RESEND_API_KEY) {
    resend = new ResendClient(process.env.RESEND_API_KEY);
  }
} catch (_) {
  // niente Resend, useremo solo SMTP
}

const smtpTransport = nodemailer.createTransport({
  host  : process.env.SMTP_HOST || 'smtps.aruba.it',
  port  : Number(process.env.SMTP_PORT || 465),
  secure: true, // SSL diretto su 465
  auth  : { user: process.env.SMTP_USER, pass: process.env.MAILER_PASS },
  logger: true,   // tienilo attivo finché debbuggi
  debug : true,
});

const FROM_NAME  = process.env.FROM_NAME  || 'Melorosso';
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;

// opzionale: mittente sicuro per Resend, finché non verifichi il dominio
const RESEND_FROM = process.env.RESEND_FROM || 'mailer@resend.dev';

/**
 * Invio ibrido:
 * 1) prova SMTP Aruba
 * 2) se timeout (o errore rete) e c'è RESEND_API_KEY -> invia via Resend (HTTPS)
 */
export async function sendMail({ to, cc, bcc, subject, text, html, replyTo }) {
  const envelopeTo = []
    .concat(to || [])
    .concat(cc || [])
    .concat(bcc || []);
  const mailFrom = `"${FROM_NAME}" <${FROM_EMAIL}>`;

  // --- 1) Tentativo SMTP ---
  try {
    const info = await smtpTransport.sendMail({
      from: mailFrom,
      to, cc, bcc, subject, text, html, replyTo,
      envelope: { from: FROM_EMAIL, to: envelopeTo },
      dsn: {
        id: 'dsn-' + Date.now(),
        return: 'headers',
        notify: ['failure','delay'],
        recipient: process.env.SMTP_USER, // dove ricevere i bounce
      },
    });
    console.log('[SMTP] OK messageId:', info?.messageId);
    console.log('[SMTP] accepted:', info?.accepted, 'rejected:', info?.rejected, 'response:', info?.response);
    return info;
  } catch (err) {
    console.error('[SMTP] ERROR:', err?.code || err?.message || err);
    const isTimeout = err?.code === 'ETIMEDOUT' || err?.message?.includes('timeout');

    // --- 2) Fallback Resend solo se ha senso ---
    if (isTimeout && resend) {
      console.log('[RESEND] Fallback attivo per timeout SMTP…');
      const r = await resend.emails.send({
        from: `${FROM_NAME} <${RESEND_FROM}>`,   // mittente sicuro finché il dominio non è verificato
        to,
        cc,
        bcc,
        reply_to: replyTo,
        subject,
        html,
        text,
      });
      console.log('[RESEND] OK id:', r?.id);
      return r;
    }

    // se non abbiamo Resend o non è timeout, rilancia l’errore
    throw err;
  }
}