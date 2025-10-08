// server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

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
 * Funzione invio Telegram
 * ========================= */
async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) throw new Error('Token o Chat ID mancanti nel .env');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error('[Telegram Error]', data);
    throw new Error(data.description);
  }

  return data;
}

/* =========================
 * /api/contact – form completo
 * ========================= */
app.post('/api/contact', async (req, res) => {
  const { name, company, website, email, message, plan } = req.body || {};

  if (!name || !email || !company) {
    return res.status(400).json({ error: 'Nome, email e azienda sono obbligatori.' });
  }

  const text = `
📩 <b>Nuovo contatto dal sito Melorosso</b>

👤 <b>Nome:</b> ${name}
🏢 <b>Azienda:</b> ${company}
📧 <b>Email:</b> ${email}
🌐 <b>Sito:</b> ${website || 'Non fornito'}
💬 <b>Messaggio:</b>
${message || 'Nessun messaggio.'}

📦 <b>Piano:</b> ${plan || 'Non specificato'}
🕓 ${new Date().toLocaleString('it-IT')}
`;

  try {
    await sendTelegramMessage(text.trim());
    console.log('📨 Telegram inviato da:', email);
    res.status(200).json({ message: 'Messaggio inviato con successo!' });
  } catch (err) {
    console.error('❌ Errore invio Telegram:', err.message);
    res.status(500).json({ error: 'Errore durante l’invio del messaggio.' });
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

  const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  const text = `
🚀 <b>Nuova Richiesta Demo AI</b>

🌐 <b>Sito:</b> <a href="${normalizedUrl}">${siteUrl}</a>
📍 <b>Fonte:</b> ${source || 'Non specificata'}
🕓 ${new Date().toLocaleString('it-IT')}
`;

  try {
    await sendTelegramMessage(text.trim());
    console.log('📨 Telegram inviato per:', siteUrl);
    res.status(200).json({ message: 'Richiesta inviata con successo!' });
  } catch (err) {
    console.error('❌ Errore invio Telegram:', err.message);
    res.status(500).json({ error: 'Errore durante l’invio della richiesta.' });
  }
});

/* =========================
 * /api/test-telegram – test manuale
 * ========================= */
app.post('/api/test-telegram', async (_req, res) => {
  try {
    const data = await sendTelegramMessage('✅ Test Telegram OK — connessione funzionante!');
    res.json({ ok: true, response: data });
  } catch (err) {
    console.error('❌ Test Telegram fallito:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================
 * Health-check
 * ========================= */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* =========================
 * Avvio server
 * ========================= */
app.listen(PORT, () => {
  console.log(`✅ Server up on port ${PORT}`);
});