// server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { sendMail } from './services/mailer.js';

const app = express();
const PORT = process.env.PORT || 3001;

/* =========================
 * CORS
 * ========================= */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length
    ? allowedOrigins
    : ['http://localhost:5173', 'https://melorosso.it', 'https://www.melorosso.it'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
}));

app.use(express.json({ limit: '512kb' }));

/* =========================
 * Helpers mittente e BCC
 * ========================= */
const DEFAULT_BCC = process.env.MAIL_BCC || ''; // es: tua.gmail@gmail.com
const addBccIfAny = (mail) => {
  if (DEFAULT_BCC) {
    if (Array.isArray(mail.bcc)) mail.bcc.push(DEFAULT_BCC);
    else if (mail.bcc) mail.bcc = [mail.bcc, DEFAULT_BCC];
    else mail.bcc = DEFAULT_BCC;
  }
  return mail;
};

/* =========================
 * /api/contact – form completo
 * ========================= */
app.post('/api/contact', async (req, res) => {
  const { name, company, website, email, message, plan } = req.body || {};
  if (!name || !email || !company) {
    return res.status(400).json({ error: 'Nome, email e nome azienda sono obbligatori.' });
  }

  const text = `Nuova Richiesta di Contatto
Piano: ${plan || 'Non specificato'}
Nome: ${name}
Email: ${email}
Azienda: ${company}
Sito: ${website || 'Non fornito'}

Messaggio:
${message || 'Nessun messaggio.'}`;

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
    await sendMail(addBccIfAny({
      to: 'info@melorosso.it',
      replyTo: email,
      subject: `Nuova richiesta dal sito • Piano: ${plan || 'Non specificato'}`,
      text,
      html,
    }));
    console.log('📨 /api/contact OK da:', email);
    return res.status(200).json({ message: 'Messaggio inviato con successo!' });
  } catch (err) {
    console.error('❌ /api/contact errore:', err?.code || err?.message || err);
    return res.status(500).json({ error: 'Si è verificato un errore durante l’invio del messaggio.' });
  }
});

/* =========================
 * /api/request-demo – dal widget
 * ========================= */
app.post('/api/request-demo', async (req, res) => {
  const { siteUrl, source } = req.body || {};
  if (!siteUrl || typeof siteUrl !== 'string') {
    return res.status(400).json({ error: 'Il sito web è obbligatorio.' });
  }

  const url = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  const text = `Nuova Richiesta Demo AI
Sito: ${siteUrl}
Fonte: ${source || 'Non specificata'}`;

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">
      <h2 style="margin:0 0 8px;color:#222;">🚀 Nuova Richiesta Demo AI</h2>
      <p>Richiesta per il seguente sito:</p>
      <p style="background:#f7f7f7;padding:12px;border-radius:6px;font-size:18px;margin:8px 0;">
        <strong><a href="${url}" target="_blank" rel="noopener noreferrer">${siteUrl}</a></strong>
      </p>
      <p><strong>Fonte:</strong> ${source || 'Non specificata'}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:12px 0;" />
      <p style="font-size:12px;color:#777;">Inviato automaticamente dal widget “Request Demo”.</p>
    </div>
  `;

  try {
    await sendMail(addBccIfAny({
      to: 'info@melorosso.it',
      subject: `🚀 Nuova Richiesta Demo AI per: ${siteUrl}`,
      text,
      html,
    }));
    console.log('📨 /api/request-demo OK per:', siteUrl);
    return res.status(200).json({ message: 'Richiesta inviata con successo!' });
  } catch (err) {
    console.error('❌ /api/request-demo errore:', err?.code || err?.message || err);
    return res.status(500).json({ error: 'Si è verificato un errore durante l’invio della richiesta.' });
  }
});

/* =========================
 * /api/test-mail – debug consegna
 * ========================= */
app.post('/api/test-mail', async (_req, res) => {
  try {
    const info = await sendMail(addBccIfAny({
      to: ['info@melorosso.it'],
      subject: 'Test consegna SMTP Aruba',
      text: 'Se leggi questa email, l’invio funziona.',
      html: '<p>Se leggi questa email, l’invio funziona.</p>',
    }));
    return res.json({
      ok: true,
      messageId: info?.messageId,
      accepted: info?.accepted,
      rejected: info?.rejected,
      response: info?.response,
      envelope: info?.envelope,
    });
  } catch (e) {
    console.error('/api/test-mail error:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/* =========================
 * Health-check
 * ========================= */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* =========================
 * Avvio
 * ========================= */
app.listen(PORT, () => {
  console.log(`✅ Server up on port ${PORT}`);
});