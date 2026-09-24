import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { decryptSecret, encryptSecret } from '../utils/secretBox.js';
import {
  buildAuthorizeUrl,
  createOAuthState,
  exchangeCodeForTokens,
  fetchConnections,
  getStoredConnection,
  isXeroConfigured,
  revokeRefreshToken,
  xeroApiGet,
  XERO_SCOPES
} from '../utils/xero.js';

const STATE_COOKIE = 'xero_oauth_state';

const adminPortalUrl = () => (process.env.ADMIN_PORTAL_URL || 'http://localhost:5173').replace(/\/$/, '');

// The callback is a top-level browser navigation, so failures redirect back to
// Settings with a reason rather than rendering JSON at the user.
const redirectToSettings = (res, params) =>
  res.redirect(`${adminPortalUrl()}/settings?${new URLSearchParams(params).toString()}`);

export const getXeroStatus = catchAsync(async (req, res, next) => {
  const connection = await getStoredConnection();

  res.json({
    success: true,
    data: {
      configured: isXeroConfigured(),
      connected: Boolean(connection) && connection.status === 'active',
      status: connection?.status || 'disconnected',
      tenant_name: connection?.tenant_name || null,
      connected_at: connection?.created_at ? new Date(connection.created_at).toISOString() : null,
      last_synced_at: connection?.last_synced_at ? new Date(connection.last_synced_at).toISOString() : null,
      scopes: connection?.scopes || null
    }
  });
});

// Step 1 — send the admin to Xero. Reached by a top-level link, not XHR, so it
// answers with a 302 rather than JSON.
export const startXeroConnect = catchAsync(async (req, res, next) => {
  if (!isXeroConfigured()) {
    return redirectToSettings(res, { xero: 'error', reason: 'not_configured' });
  }

  const state = createOAuthState();
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // must survive the redirect back from Xero
    maxAge: 10 * 60 * 1000
  });

  res.redirect(buildAuthorizeUrl(state));
});

// Step 2 — Xero redirects here with ?code&state. The code is exchanged
// server-side so the client secret never reaches the browser.
export const xeroCallback = catchAsync(async (req, res, next) => {
  const { code, state, error } = req.query;
  const expectedState = req.cookies?.[STATE_COOKIE];

  res.clearCookie(STATE_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  if (error) {
    logger.warn(`Xero authorisation declined: ${error}`);
    return redirectToSettings(res, { xero: 'error', reason: 'declined' });
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    logger.warn('Xero callback rejected: state mismatch or missing code');
    return redirectToSettings(res, { xero: 'error', reason: 'state' });
  }

  let tokenSet;
  try {
    tokenSet = await exchangeCodeForTokens(code);
  } catch (err) {
    return redirectToSettings(res, { xero: 'error', reason: 'exchange' });
  }

  const connections = await fetchConnections(tokenSet.access_token);
  const org = Array.isArray(connections) ? connections[0] : null;
  if (!org?.tenantId) {
    return redirectToSettings(res, { xero: 'error', reason: 'no_organisation' });
  }

  // One live connection in v1: replace whatever was there before.
  await db('xero_connections').whereIn('status', ['active', 'needs_reauth']).delete();

  const [connectionId] = await db('xero_connections').insert({
    tenant_id: org.tenantId,
    tenant_name: org.tenantName || null,
    access_token: encryptSecret(tokenSet.access_token),
    refresh_token: encryptSecret(tokenSet.refresh_token),
    access_expires_at: new Date(Date.now() + (Number(tokenSet.expires_in) || 1800) * 1000),
    scopes: String(tokenSet.scope || XERO_SCOPES).slice(0, 500),
    status: 'active',
    connected_by: req.user.id
  });

  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'XERO_CONNECTED',
    entity_type: 'xero_connection',
    entity_id: connectionId,
    meta: JSON.stringify({ tenant_name: org.tenantName || null }),
    ip_address: req.ip || null
  });

  logger.info(`Xero connected to organisation "${org.tenantName}"`);
  return redirectToSettings(res, { xero: 'connected' });
});

export const disconnectXero = catchAsync(async (req, res, next) => {
  const connection = await getStoredConnection();
  if (!connection) {
    throw new ApiError(404, 'Xero is not connected');
  }

  try {
    await revokeRefreshToken(decryptSecret(connection.refresh_token));
  } catch (err) {
    logger.warn(`Could not decrypt refresh token for revocation: ${err.message}`);
  }

  await db('xero_connections').where('id', connection.id).delete();

  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'XERO_DISCONNECTED',
    entity_type: 'xero_connection',
    entity_id: connection.id,
    meta: JSON.stringify({ tenant_name: connection.tenant_name || null }),
    ip_address: req.ip || null
  });

  res.json({ success: true, message: 'Xero disconnected' });
});

// Bank balances come from the Bank Summary report; the Accounts endpoint lists
// the accounts but carries no balance. A balance we cannot read stays null so
// the UI shows "—" rather than a misleading £0.00.
const parseBankSummary = (report) => {
  const balances = new Map();
  const rows = report?.Reports?.[0]?.Rows || [];

  for (const section of rows) {
    for (const row of section.Rows || []) {
      const cells = row.Cells || [];
      if (cells.length < 2) continue;

      const nameCell = cells[0];
      const name = nameCell?.Value;
      if (!name) continue;

      const accountId = (nameCell.Attributes || []).find((a) => a.Id === 'accountID')?.Value || null;
      const closing = parseFloat(cells[cells.length - 1]?.Value);
      if (!Number.isFinite(closing)) continue;

      if (accountId) balances.set(`id:${accountId}`, closing);
      balances.set(`name:${String(name).toLowerCase()}`, closing);
    }
  }
  return balances;
};

export const getXeroBankAccounts = catchAsync(async (req, res, next) => {
  const accountsPayload = await xeroApiGet('/Accounts', { where: 'Type=="BANK"' });
  const accounts = accountsPayload?.Accounts || [];

  let balances = new Map();
  try {
    const today = new Date();
    const fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];
    const summary = await xeroApiGet('/Reports/BankSummary', { fromDate, toDate });
    balances = parseBankSummary(summary);
  } catch (err) {
    // Balances are a bonus; the account list is still useful without them.
    logger.warn(`Xero bank summary unavailable: ${err.message}`);
  }

  const data = accounts.map((a) => {
    const byId = balances.get(`id:${a.AccountID}`);
    const byName = balances.get(`name:${String(a.Name || '').toLowerCase()}`);
    const balance = byId ?? byName ?? null;
    return {
      account_id: a.AccountID,
      name: a.Name || null,
      code: a.Code || null,
      currency: a.CurrencyCode || null,
      bank_account_number: a.BankAccountNumber || null,
      status: a.Status || null,
      balance: balance !== null && balance !== undefined ? Number(balance).toFixed(2) : null
    };
  });

  const total = data.reduce((sum, a) => sum + (a.balance !== null ? parseFloat(a.balance) : 0), 0);
  const anyBalance = data.some((a) => a.balance !== null);

  res.json({
    success: true,
    data: {
      accounts: data,
      total_balance: anyBalance ? total.toFixed(2) : null
    }
  });
});
