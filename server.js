// server.js
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import 'dotenv/config';

// ⚠️ Resend è opzionale: abilitalo solo se RESEND_API_KEY è impostata
let Resend = null;
try {
  // import dinamico per non rompere se non installato
  ({ Resend } = await import('resend'));
} catch (_) {
  // ok, semplicemente non useremo Resend
}

const app = express();
const PORT = process.env.PORT || 3001;

/* =========================
 * CORS
 * ========================= */
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://melorosso.it',
    'https://www.melorosso.it',
  ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '512kb' }));

/* =========================
 * Email provider selector
 * - FORCE_PROVIDER= smtp | resend | auto
 * - auto: su Render usa Resend se disponibile, altrimenti SMTP
 * ========================= */
const FORCE_PROVIDER = (process.env.FORCE_PROVIDER || 'auto').toLowerCase();
const IS_RENDER = !!process.env.RENDER; // env settata su Render
const HAS_RESEND = !!process.env.RESEND_API_KEY;

function chooseProvider() {
  if (FORCE_PROVIDER === 'smtp') return 'smtp';
  if (FORCE_PROVIDER === 'resend') return 'resend';
  // auto
  if (IS_RENDER && HAS_RESEND) return 'resend';
  return 'smtp';
}

/* =========================
 * SMTP (per locale o VPS)
 * ========================= */
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = SMTP_PORT === 465;

const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,           // es: smtp.aruba.it o smtps.aruba.it
  port: SMTP_PORT,                       // 465 (SSL) o 587 (STARTTLS)
  secure: SMTP_SECURE,                   // true solo su 465
  auth: {
    user: process.env.SMTP_USER,         // es: mailer@melorosso.it
    pass: process.env.MAILER_PASS,       // password casella
  },
  // su 587 abilita STARTTLS
  requireTLS: !SMTP_SECURE,
  // logger/debug disabilitati in prod per log puliti
  logger: false,
  debug: false,
});

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@localhost';
const FROM_NAME  = process.env.FROM_NAME  || 'Melorosso';

// Resend client (se disponibile)
const resendClient = HAS_RESEND && Resend ? new Resend(process.env.RESEND_API_KEY) : null;

/* =========================
 * Funzione di invio con fallback
 * ========================= */
async function sendEmail({ subject, html, text, to, replyTo }) {
  const provider = chooseProvider();

  // 1) Preferisci provider scelto
  if (provider === 'resend' && resendClient) {
    return await resendClient.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      reply_to: replyTo,
      subject,
      html,
      text,
    });
  }
  if (provider === 'smtp') {
    try {
      return await smtpTransport.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to,
        replyTo,
        subject,
        html,
        text,
      });
    } catch (err) {
      // Se siamo su Render e l’SMTP va in timeout, prova Resend come fallback
      if (IS_RENDER && resendClient) {
        return await resendClient.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to,
          reply_to: replyTo,
          subject,
          html,
          text,
        });
      }
      throw err;
    }
  }

  // 2) Auto senza provider: tenta Resend, poi SMTP
  if (resendClient) {
    return await resendClient.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      reply_to: replyTo,
      subject,
      html,
      text,
    });
  }
  return await smtpTransport.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    replyTo,
    subject,
    html,
    text,
  });
}

/* =========================
 * Endpoint: /api/contact
 * ========================= */
app.post('/api/contact', async (req, res) => {
  const { name, company, website, email, message, plan } = req.body || {};
  if (!name || !email || !company) {
    return res.status(400).json({ error: 'Nome, email e nome azienda sono obbligatori.' });
  }

  const subject = `Nuova richiesta dal sito • Piano: ${plan || 'Non specificato'}`;
  const text = `Nuova Richiesta di Contatto
Piano: ${plan || 'Non specificato'}
Nome: ${name}
Email: ${email}
Azienda: ${company}
Sito: ${website || 'Non fornito'}

Messaggio:
${message || 'Nessun messaggio.'}
`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">
      <h2 style="margin:0 0 8px;color:#222;">Nuova Richiesta di Contatto</h2>
      <p><strong>Piano:</strong> ${plan || 'Non specificato'}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:12px 0;" />
      <p><strong>Nome:</strong> ${name}</p>
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <p><strong>Azienda:</strong> ${company}</p>
      <p><strong>Sito:</strong> ${
        website ? `<a href="${website}" target="_blank" rel="noopener noreferrer">${website}</a>` : 'Non fornito'
      }</p>
      <p><strong>Messaggio:</strong></p>
      <div style="background:#f7f7f7;padding:12px;border-radius:6px;white-space:pre-wrap;">
        ${message || 'Nessun messaggio.'}
      </div>
    </div>
  `;

  try {
    await sendEmail({
      to: 'info@melorosso.it',
      replyTo: email,
      subject,
      html,
      text,
    });
    console.log('📨 /api/contact OK da:', email);
    return res.status(200).json({ message: 'Messaggio inviato con successo!' });
  } catch (error) {
    console.error('❌ /api/contact errore:', error?.code || error?.message || error);
    return res.status(500).json({ error: 'Si è verificato un errore durante l’invio del messaggio.' });
  }
});

/* =========================
 * Endpoint: /api/request-demo
 * ========================= */
app.post('/api/request-demo', async (req, res) => {
  const { siteUrl, source } = req.body || {};
  if (!siteUrl || typeof siteUrl !== 'string') {
    return res.status(400).json({ error: 'Il sito web è obbligatorio.' });
  }
  const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  const subject = `🚀 Nuova Richiesta Demo AI per: ${siteUrl}`;
  const text = `Nuova Richiesta Demo AI
Sito: ${siteUrl}
Fonte: ${source || 'Non specificata'}
`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">
      <h2 style="margin:0 0 8px;color:#222;">🚀 Nuova Richiesta Demo AI</h2>
      <p>Richiesta per il seguente sito:</p>
      <p style="background:#f7f7f7;padding:12px;border-radius:6px;font-size:18px;margin:8px 0;">
        <strong><a href="${normalizedUrl}" target="_blank" rel="noopener noreferrer">${siteUrl}</a></strong>
      </p>
      <p><strong>Fonte:</strong> ${source || 'Non specificata'}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:12px 0;" />
      <p style="font-size:12px;color:#777;">Inviato automaticamente dal widget “Request Demo”.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: 'info@melorosso.it',
      subject,
      html,
      text,
    });
    console.log('📨 /api/request-demo OK per:', siteUrl);
    return res.status(200).json({ message: 'Richiesta inviata con successo!' });
  } catch (error) {
    console.error('❌ /api/request-demo errore:', error?.code || error?.message || error);
    return res.status(500).json({ error: 'Si è verificato un errore durante l’invio della richiesta.' });
  }
});

/* =========================
 * Health-check
 * ========================= */
app.get('/health', (_, res) => res.status(200).send('ok'));

/* =========================
 * Avvio
 * ========================= */
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT} | provider=${chooseProvider()} | render=${IS_RENDER} | resend=${HAS_RESEND}`);
});