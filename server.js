import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const app = express();

// CORS
app.use(cors({ origin: ['https://melorosso.it', 'https://www.melorosso.it'], methods: ['POST'] }));
app.use(express.json({ limit: '512kb' }));

// === SMTP CONFIG ===
const PORT_NUM = Number(process.env.SMTP_PORT || 465);
const SECURE = PORT_NUM === 465; // 465=SSL, 587=STARTTLS

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,             // es: smtp.aruba.it
  port: PORT_NUM,                          // 465 o 587
  secure: SECURE,                          // true per 465, false per 587
  auth: {
    user: process.env.SMTP_USER,           // mailer@melorosso.it
    pass: process.env.MAILER_PASS,         // <-- usa MAILER_PASS come da tuo .env
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  requireTLS: !SECURE,                     // forza STARTTLS su 587
  logger: true,
  debug: false,
});

transport.verify()
  .then(() => console.log(`✅ SMTP pronto: ${process.env.SMTP_HOST}:${PORT_NUM} secure=${SECURE}`))
  .catch(err => console.error('❌ SMTP verify error:', err?.code || err?.message || err));

// Mittente
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;
const FROM_NAME  = process.env.FROM_NAME  || 'Melorosso';

app.post('/api/request-demo', async (req, res) => {
  const { siteUrl, source } = req.body;
  if (!siteUrl || typeof siteUrl !== 'string') {
    return res.status(400).json({ error: 'Il sito web è obbligatorio.' });
  }
  const url = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: 'info@melorosso.it',
    replyTo: 'info@melorosso.it',
    subject: `🚀 Nuova richiesta demo per: ${siteUrl}`,
    text: `Nuova Richiesta Demo AI
Sito: ${siteUrl}
Fonte: ${source || 'Non specificata'}`,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6;">
        <h2 style="color:#333;">🚀 Nuova Richiesta Demo AI</h2>
        <p><strong>Sito:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${siteUrl}</a></p>
        <p><strong>Fonte:</strong> ${source || 'Non specificata'}</p>
        <hr/>
        <p style="font-size:12px;color:#666">Inviato automaticamente dal widget "Request Demo".</p>
      </div>
    `,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log('📨 SMTP OK messageId:', info?.messageId);
    return res.status(200).json({ message: 'Richiesta inviata con successo!' });
  } catch (error) {
    console.error('❌ Errore SMTP:', { code: error?.code, command: error?.command, message: error?.message });
    return res.status(500).json({ error: 'Errore durante l’invio della richiesta.' });
  }
});

app.get('/health', (_, res) => res.status(200).send('ok'));

app.listen(process.env.PORT || 3001, () => {
  console.log(`Server in ascolto 🚀 sulla porta ${process.env.PORT || 3001}`);
});