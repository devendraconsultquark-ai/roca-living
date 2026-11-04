// Send ONE test email to check the server's email settings (.env).
//
//   cd server
//   node scripts/test-email.mjs --to=you@example.com
//
// Uses Microsoft 365 when MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET and
// MS_SENDER are all set (every email then goes from MS_SENDER); otherwise the
// SMTP settings (EMAIL_HOST / EMAIL_USER / EMAIL_PASS). It is sent even when
// EMAIL_ENABLED is off, and only to the --to address. Secrets are never printed.
import 'dotenv/config';
import { sendEmail } from '../src/utils/email.js';
import { graphConfig } from '../src/utils/msGraphMail.js';

const to = (process.argv.find((a) => a.startsWith('--to=')) || '').slice(5).trim();
if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) {
  console.log('Usage: node scripts/test-email.mjs --to=you@example.com');
  process.exit(1);
}

const graph = graphConfig();
const missing = ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'MS_SENDER'].filter((k) => !(process.env[k] || '').trim());
if (graph) {
  console.log(`Method: Microsoft 365 · from ${graph.sender} · tenant ${graph.tenantId} · app ${graph.clientId}`);
} else {
  if (missing.length < 4) console.log(`Microsoft 365 is NOT used: missing ${missing.join(', ')} in .env`);
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Method: none — no Microsoft 365 settings and no SMTP settings. Nothing sent.');
    process.exit(1);
  }
  console.log(`Method: SMTP · ${process.env.EMAIL_HOST || 'smtp.mailtrap.io'}:${process.env.EMAIL_PORT || '2525'} · from ${process.env.SMTP_FROM || 'noreply@rocaliving.com'}`);
}
console.log(`EMAIL_ENABLED=${process.env.EMAIL_ENABLED === 'true' ? 'true (statements will be emailed)' : 'not true (statements are NOT emailed; this test still is)'}`);

try {
  const info = await sendEmail({
    to,
    essential: true,
    subject: 'Roca Living — test email',
    text: `This is a test from the Roca Living server.\n\nIf you can read this, statement emails will go out the same way${graph ? ` (from ${graph.sender} through Microsoft 365)` : ' (SMTP)'}.`,
  });
  console.log(info ? `Sent to ${to}. ${info.response || ''}` : 'Not sent (email is not configured).');
  process.exit(info ? 0 : 1);
} catch (err) {
  console.log(`FAILED: ${err.message}`);
  process.exit(1);
}
