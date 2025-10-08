import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import 'dotenv/config';

const app = express();

// CORS (limita ai tuoi domini in prod)
app.use(cors({ origin: ['https://melorosso.it', 'https://www.melorosso.it'], methods: ['POST'] }));
app.use(express.json({ limit: '512kb' }));

const resend = new Resend(process.env.RESEND_API_KEY);

// helper: mittente con fallback
const FROM_EMAIL = process.env.FROM_EMAIL || 'mailer@resend.dev';
const FROM_NAME  = process.env.FROM_NAME  || 'Melorosso';

app.post('/api/request-demo', async (req, res) => {
  const { siteUrl, source } = req.body;

  // validazione semplice
  if (!siteUrl || typeof siteUrl !== 'string') {
    return res.status(400).json({ error: 'Il sito web è obbligatorio.' });
  }

  // normalizza un minimo l’URL per i link cliccabili
  const url = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,          // OK con resend.dev o dominio verificato
      to: 'info@melorosso.it',
      reply_to: 'info@melorosso.it',                 // metti qui la casella dove leggi
      subject: `🚀 Nuova richiesta demo per: ${siteUrl}`,
      html: `
        <h2>🚀 Nuova Richiesta Demo AI</h2>
        <p><strong>Sito:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${siteUrl}</a></p>
        <p><strong>Fonte:</strong> ${source || 'Non specificata'}</p>
        <hr/>
        <p style="font-size:12px;color:#666">Inviato automaticamente dal widget "Request Demo".</p>
      `,
      text: `Nuova Richiesta Demo AI
Sito: ${siteUrl}
Fonte: ${source || 'Non specificata'}`,
      // bcc: 'log@melorosso.it', // opzionale: archivio
    });

    console.log('Resend OK:', result?.id || 'no-id');
    return res.status(200).json({ message: 'Richiesta inviata con successo!' });
  } catch (error) {
    console.error('Errore Resend:', error?.message || error);
    // Resend talvolta espone dettagli in error.response?.data
    if (error?.response?.data) {
      console.error('Resend details:', error.response.data);
    }
    return res.status(500).json({ error: 'Errore durante l’invio della richiesta.' });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log('Server in ascolto 🚀');
});