import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import 'dotenv/config'; // Per caricare le variabili d'ambiente da .env

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Abilita CORS per tutte le rotte
app.use(express.json()); // Per parsare il body delle richieste in JSON

// Configurazione del trasporto Nodemailer con le tue credenziali
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // 'smtps.aruba.it'
  port: process.env.SMTP_PORT, // 465
  secure: true,
  auth: {
    user: process.env.SMTP_USER, // 'mailer@melorosso.it'
    pass: process.env.MAILER_PASS, // La tua password
  },
});

// Endpoint per ricevere i dati del form e inviare l'email
app.post('/api/contact', async (req, res) => {
  const { name, company, website, email, message, plan } = req.body;

  // Validazione base
  if (!name || !email || !company) {
    return res.status(400).json({ error: 'Nome, email e nome azienda sono obbligatori.' });
  }

  // Contenuto dell'email che riceverai
  const mailOptions = {
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to: 'info@melorosso.it', // L'email a cui inviare la notifica
    replyTo: email, // Permette di rispondere direttamente al cliente
    subject: `Nuova richiesta dal sito per il piano: ${plan || 'Non specificato'}`,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6;">
        <h2 style="color: #333;">Nuova Richiesta di Contatto</h2>
        <p><strong>Piano Selezionato:</strong> ${plan || 'Non specificato'}</p>
        <hr>
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Azienda:</strong> ${company}</p>
        <p><strong>Sito Web:</strong> <a href="${website}" target="_blank">${website || 'Non fornito'}</a></p>
        <p><strong>Messaggio:</strong></p>
        <p style="background-color: #f4f4f4; padding: 15px; border-radius: 5px;">
          ${message || 'Nessun messaggio.'}
        </p>
      </div>
    `,
  };

  try {
    await transport.sendMail(mailOptions);
    console.log('Email inviata con successo da:', email);
    res.status(200).json({ message: 'Messaggio inviato con successo!' });
  } catch (error) {
    console.error("Errore durante l'invio dell'email:", error);
    res.status(500).json({ error: "Si è verificato un errore durante l'invio del messaggio." });
  }
});

app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});