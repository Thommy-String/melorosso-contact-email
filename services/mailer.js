// services/mailer.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host  : process.env.SMTP_HOST || 'smtps.aruba.it',
  port  : Number(process.env.SMTP_PORT || 465),
  secure: true, // 465 SSL
  auth  : { user: process.env.SMTP_USER, pass: process.env.MAILER_PASS },
  logger: true,   // abilita log SMTP (disattivalo quando hai finito i test)
  debug : true,
});

export async function sendMail({ to, cc, bcc, subject, text, html, replyTo }) {
  const fromName  = process.env.FROM_NAME  || 'Melorosso';
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;

  const mail = {
    from: `"${fromName}" <${fromEmail}>`,
    to, cc, bcc, subject, replyTo,
    text, html,
    envelope: { from: fromEmail, to: [].concat(to || [], cc || [], bcc || []) },
    dsn: {
      id: 'dsn-' + Date.now(),
      return: 'headers',
      notify: ['failure','delay'],
      recipient: process.env.SMTP_USER,
    },
  };

  const info = await transporter.sendMail(mail);
  console.log('[SMTP] messageId:', info?.messageId);
  console.log('[SMTP] accepted:', info?.accepted);
  console.log('[SMTP] rejected:', info?.rejected);
  console.log('[SMTP] response:', info?.response);
  console.log('[SMTP] envelope:', info?.envelope);
  return info;
}