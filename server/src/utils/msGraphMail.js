import fs from 'fs';

// Sending email through Microsoft 365 with an app registration (client
// credentials, Graph Mail.Send). No mailbox password is used: the client's IT
// limits the app to the one mailbox in Exchange Online. The app's details live
// only in the server .env (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET,
// MS_SENDER); every email goes from MS_SENDER.

const GRAPH = 'https://graph.microsoft.com/v1.0';
// Graph refuses a sendMail request body over ~4 MB (attachments are base64).
const MAX_ATTACHMENTS_BYTES = 3 * 1024 * 1024;

let fetchImpl = (...args) => fetch(...args);
// Tests swap in a fake Microsoft (never the real one).
export const setGraphFetchForTests = (fn) => { fetchImpl = fn || ((...args) => fetch(...args)); tokenCache.clear(); };

// The Microsoft 365 settings from .env, or null when any is missing (then
// email goes through SMTP as before).
export const graphConfig = () => {
  const tenantId = (process.env.MS_TENANT_ID || '').trim();
  const clientId = (process.env.MS_CLIENT_ID || '').trim();
  const clientSecret = (process.env.MS_CLIENT_SECRET || '').trim();
  const sender = (process.env.MS_SENDER || '').trim();
  return tenantId && clientId && clientSecret && sender ? { tenantId, clientId, clientSecret, sender } : null;
};

// Tokens last about an hour; keep each one until a minute before it ends.
const tokenCache = new Map();

export const getGraphToken = async ({ tenantId, clientId, clientSecret }) => {
  const key = `${tenantId}|${clientId}|${clientSecret.length}`;
  const hit = tokenCache.get(key);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
  const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    // e.g. AADSTS7000215 invalid client secret / AADSTS90002 tenant not found.
    // First line only, without Microsoft's "Trace ID … Correlation ID …" tail.
    const why = (body.error_description || body.error || `HTTP ${res.status}`)
      .split(/\r?\n/)[0].replace(/\s*Trace ID:.*$/s, '').trim();
    throw new Error(`Microsoft sign-in failed: ${why}`);
  }
  tokenCache.set(key, { token: body.access_token, expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000 });
  return body.access_token;
};

const recipients = (list) => String(list || '')
  .split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  .map((address) => ({ emailAddress: { address } }));

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// nodemailer-style attachments ({ filename, path | content, contentType })
// → Graph file attachments.
const graphAttachments = (attachments = []) => {
  let total = 0;
  const out = attachments.map((a) => {
    const buf = a.path ? fs.readFileSync(a.path) : Buffer.isBuffer(a.content) ? a.content : Buffer.from(String(a.content ?? ''));
    total += buf.length;
    return {
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.filename || 'attachment',
      contentType: a.contentType || 'application/octet-stream',
      contentBytes: buf.toString('base64'),
    };
  });
  if (total > MAX_ATTACHMENTS_BYTES) throw new Error('The attachments are too large to email (over 3 MB)');
  return out;
};

// Send one email from the configured mailbox. Graph answers 202 with no body;
// the email is saved in that mailbox's Sent Items.
export const sendViaGraph = async (cfg, { to, cc, subject, text, html, attachments }) => {
  const token = await getGraphToken(cfg);
  const from = cfg.sender;
  const message = {
    subject,
    body: html
      ? { contentType: 'HTML', content: html }
      : { contentType: 'HTML', content: escapeHtml(text || '').replace(/\n/g, '<br>') },
    toRecipients: recipients(to),
    ...(cc ? { ccRecipients: recipients(cc) } : {}),
    ...(attachments && attachments.length ? { attachments: graphAttachments(attachments) } : {}),
  };
  if (!message.toRecipients.length) throw new Error('No recipient');
  const res = await fetchImpl(`${GRAPH}/users/${encodeURIComponent(from)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });
  if (res.status !== 202 && !res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code;
    let why = body?.error?.message || `HTTP ${res.status}`;
    if (res.status === 403 || code === 'ErrorAccessDenied') why = `Microsoft does not allow this app to send as ${from} (${why})`;
    if (res.status === 404 || code === 'ErrorInvalidUser' || code === 'MailboxNotEnabledForRESTAPI') why = `Mailbox ${from} was not found (${why})`;
    throw new Error(why);
  }
  return {
    messageId: `graph-${Date.now()}`,
    accepted: [...recipients(to), ...recipients(cc)].map((r) => r.emailAddress.address),
    rejected: [],
    response: `${res.status} Accepted by Microsoft 365`,
  };
};
