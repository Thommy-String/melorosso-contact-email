// server.js
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

/* =========================
 * Middleware
 * ========================= */
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://melorosso.it',
    'https://www.melorosso.it',
  ],
  methods: ['POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '512kb' }));

/* =========================
 * Nodemailer - SMTP semplice (come versione “funzionava”)
 * - secure: true se 465, altrimenti false
 * - niente pool, niente requireTLS/timeout extra
 * ========================= */
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,           // es: smtps.aruba.it o smtp.aruba.it
  port: SMTP_PORT,                       // 465 (SSL) o 587
  secure: SMTP_PORT === 465,             // true solo su 465
  auth: {
    user: process.env.SMTP_USER,         // es: mailer@melorosso.it
    pass: process.env.MAILER_PASS,       // password casella
  },
});

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;
const FROM_NAME  = process.env.FROM_NAME  || 'Melorosso';

/* =========================
 * Endpoint: /api/contact
 * (form completo: name, company, website, email, message, plan)
 * ========================= */
app.post('/api/contact', async (req, res) => {
  const { name, company, website, email, message, plan } = req.body || {};

  // Validazione base
  if (!name || !email || !company) {
    return res.status(400).json({ error: 'Nome, email e nome azienda sono obbligatori.' });
  }

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: 'info@melorosso.it',
    replyTo: email, // rispondi direttamente al cliente
    subject: `Nuova richiesta dal sito • Piano: ${plan || 'Non specificato'}`,
    text:
`Nuova Richiesta di Contatto
Piano: ${plan || 'Non specificato'}
Nome: ${name}
Email: ${email}
Azienda: ${company}
Sito: ${website || 'Non fornito'}

Messaggio:
${message || 'Nessun messaggio.'}
`,
    html: `
      <div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">
        <h2 style="margin:0 0 8px;color:#222;">Nuova Richiesta di Contatto</h2>
        <p><strong>Piano:</strong> ${plan || 'Non specificato'}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:12px 0;" />
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Azienda:</strong> ${company}</p>
        <p><strong>Sito:</strong> ${
          website
            ? `<a href="${website}" target="_blank" rel="noopener noreferrer">${website}</a>`
            : 'Non fornito'
        }</p>
        <p><strong>Messaggio:</strong></p>
        <div style="background:#f7f7f7;padding:12px;border-radius:6px;white-space:pre-wrap;">
          ${message || 'Nessun messaggio.'}
        </div>
      </div>
    `,
  };

  try {
    await transport.sendMail(mailOptions);
    console.log('📨 /api/contact OK da:', email);
    return res.status(200).json({ message: 'Messaggio inviato con successo!' });
  } catch (error) {
    console.error('❌ /api/contact errore:', error);
    return res.status(500).json({ error: 'Si è verificato un errore durante l’invio del messaggio.' });
  }
});

/* =========================
 * Endpoint: /api/request-demo
 * (usato da RequestDemoWidget.tsx — riceve solo siteUrl, source)
 * ========================= */
app.post('/api/request-demo', async (req, res) => {
  const { siteUrl, source } = req.body || {};

  if (!siteUrl || typeof siteUrl !== 'string') {
    return res.status(400).json({ error: 'Il sito web è obbligatorio.' });
    }

  const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: 'info@melorosso.it',
    subject: `🚀 Nuova Richiesta Demo AI per: ${siteUrl}`,
    text:
`Nuova Richiesta Demo AI
Sito: ${siteUrl}
Fonte: ${source || 'Non specificata'}
`,
    html: `
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
    `,
  };

  try {
    await transport.sendMail(mailOptions);
    console.log('📨 /api/request-demo OK per:', siteUrl);
    return res.status(200).json({ message: 'Richiesta inviata con successo!' });
  } catch (error) {
    console.error('❌ /api/request-demo errore:', error);
    return res.status(500).json({ error: 'Si è verificato un errore durante l’invio della richiesta.' });
  }
});

/* =========================
 * Health-check
 * ========================= */
app.get('/health', (_, res) => res.status(200).send('ok'));

/* =========================
 * Avvio server
 * ========================= */
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});