import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { toYmd } from '../utils/dateHelpers.js';
import { decryptSecret, encryptSecret } from '../utils/secretBox.js';
import {
  buildAuthorizeUrl,
  createOAuthState,
  exchangeCodeForTokens,
  fetchConnections,
  getStoredConnection,
  getValidAccessToken,
  isXeroConfigured,
  missingXeroScopes,
  revokeRefreshToken,
  xeroApiGet,
  xeroApiRaw,
  XERO_SCOPES
} from '../utils/xero.js';
import { getInvoicesFrom, pushRentInvoices, SETTING_INVOICES_FROM } from '../utils/xeroRentInvoices.js';

// Which Xero accounts Roca Living books to (Settings → Xero → Accounts). Ids
// and codes belong to one organisation, so they are cleared when it changes.
const ACCOUNT_SETTINGS = {
  xeroRentIncomeAccountCode: { label: 'Rent invoices account', kind: 'code' },
  xeroFeeIncomeAccountCode: { label: 'Management fee income account', kind: 'code' },
  xeroLandlordBillAccountCode: { label: 'Landlord bills account', kind: 'code' },
  xeroLandlordExpenseAccountCode: { label: 'Landlord expenses account', kind: 'code' }
};

// The organisation changed: bank accounts ticked for import and the account
// settings pointed at the old one and would silently return nothing.
const clearOrganisationSettings = async (trx) => {
  await trx('xero_import_accounts').delete();
  await trx('settings').whereIn('key', [...Object.keys(ACCOUNT_SETTINGS), 'xeroRentBankAccountId', 'xeroRentInvoicesLast']).delete();
  // Invoice and contact ids belong to the old organisation too.
  await trx('xero_rent_invoices').delete();
  await trx('xero_contact_links').delete();
};

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
      scopes: connection?.scopes || null,
      // Permissions added since this connection was made: reconnect to grant them.
      missing_scopes: connection ? missingXeroScopes(connection.scopes) : [],
      needs_org_choice: Boolean(connection?.needs_org_choice)
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
  const orgs = Array.isArray(connections) ? connections.filter((c) => c?.tenantId) : [];
  if (!orgs.length) {
    return redirectToSettings(res, { xero: 'error', reason: 'no_organisation' });
  }
  // Several organisations: keep the one used before if it is among them,
  // otherwise the first — and ask the admin to confirm the right one.
  const previous = await getStoredConnection();
  const org = orgs.find((o) => o.tenantId === previous?.tenant_id) || orgs[0];
  const needsChoice = orgs.length > 1;

  const connectionId = await db.transaction(async (trx) => {
    // One live connection: replace whatever was there before.
    await trx('xero_connections').whereIn('status', ['active', 'needs_reauth']).delete();
    if (previous && previous.tenant_id !== org.tenantId) await clearOrganisationSettings(trx);
    const [id] = await trx('xero_connections').insert({
      tenant_id: org.tenantId,
      tenant_name: org.tenantName || null,
      access_token: encryptSecret(tokenSet.access_token),
      refresh_token: encryptSecret(tokenSet.refresh_token),
      access_expires_at: new Date(Date.now() + (Number(tokenSet.expires_in) || 1800) * 1000),
      scopes: String(tokenSet.scope || XERO_SCOPES).slice(0, 500),
      status: 'active',
      needs_org_choice: needsChoice,
      connected_by: req.user.id
    });
    return id;
  });

  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'XERO_CONNECTED',
    entity_type: 'xero_connection',
    entity_id: connectionId,
    meta: JSON.stringify({ tenant_name: org.tenantName || null, organisations: orgs.length }),
    ip_address: req.ip || null
  });

  logger.info(`Xero connected to organisation "${org.tenantName}"${needsChoice ? ` (1 of ${orgs.length}, awaiting choice)` : ''}`);
  return redirectToSettings(res, { xero: needsChoice ? 'choose_org' : 'connected' });
});

// GET /xero/organisations — every organisation the connection can reach.
export const getXeroOrganisations = catchAsync(async (req, res) => {
  const { connection, accessToken } = await getValidAccessToken();
  const connections = await fetchConnections(accessToken);
  res.json({
    success: true,
    data: (Array.isArray(connections) ? connections : [])
      .filter((c) => c?.tenantId)
      .map((c) => ({ tenant_id: c.tenantId, name: c.tenantName || c.tenantId, current: c.tenantId === connection.tenant_id }))
  });
});

// PUT /xero/organisation { tenant_id } — use this organisation.
export const chooseXeroOrganisation = catchAsync(async (req, res) => {
  const tenantId = String(req.body?.tenant_id || '');
  const { connection, accessToken } = await getValidAccessToken();
  const connections = await fetchConnections(accessToken);
  const org = (Array.isArray(connections) ? connections : []).find((c) => c?.tenantId === tenantId);
  if (!org) throw new ApiError(400, 'That organisation is not available on this Xero connection');

  const changed = org.tenantId !== connection.tenant_id;
  await db.transaction(async (trx) => {
    await trx('xero_connections').where('id', connection.id).update({
      tenant_id: org.tenantId,
      tenant_name: org.tenantName || null,
      needs_org_choice: false,
      updated_at: trx.fn.now()
    });
    if (changed) await clearOrganisationSettings(trx);
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'XERO_ORGANISATION_CHOSEN',
      entity_type: 'xero_connection',
      entity_id: connection.id,
      meta: JSON.stringify({ from: connection.tenant_name, to: org.tenantName, changed }),
      ip_address: req.ip || null
    });
  });
  res.json({
    success: true,
    message: changed
      ? `Now using "${org.tenantName}" — choose its bank accounts and Xero accounts again`
      : `Using "${org.tenantName}"`,
    data: { tenant_id: org.tenantId, name: org.tenantName, changed }
  });
});

// The organisation's active accounts (chart of accounts) for the settings dropdowns.
const loadAccounts = async () => {
  const payload = await xeroApiGet('/Accounts', { where: 'Status=="ACTIVE"' });
  return (payload?.Accounts || []).map((a) => ({
    account_id: a.AccountID,
    code: a.Code || null,
    name: a.Name || null,
    type: a.Type || null,
    class: a.Class || null
  }));
};

// GET /xero/accounts
export const getXeroAccounts = catchAsync(async (req, res) => {
  res.json({ success: true, data: await loadAccounts() });
});

// GET /xero/account-settings
export const getXeroAccountSettings = catchAsync(async (req, res) => {
  const rows = await db('settings').whereIn('key', Object.keys(ACCOUNT_SETTINGS)).select('key', 'value');
  const values = Object.fromEntries(Object.keys(ACCOUNT_SETTINGS).map((k) => [k, null]));
  rows.forEach((r) => { values[r.key] = r.value || null; });
  res.json({ success: true, data: values });
});

// PUT /xero/account-settings { xeroRentIncomeAccountCode, ...Code } — each value must
// exist in the connected organisation (blank clears it).
export const saveXeroAccountSettings = catchAsync(async (req, res) => {
  const b = req.body || {};
  const unknown = Object.keys(b).filter((k) => !ACCOUNT_SETTINGS[k]);
  if (unknown.length) throw new ApiError(400, `Unknown setting(s): ${unknown.join(', ')}`);

  const accounts = await loadAccounts();
  const updates = {};
  for (const [key, def] of Object.entries(ACCOUNT_SETTINGS)) {
    if (!(key in b)) continue;
    const value = String(b[key] ?? '').trim();
    if (value) {
      const ok = def.kind === 'bank'
        ? accounts.some((a) => a.account_id === value && a.type === 'BANK')
        : accounts.some((a) => a.code === value);
      if (!ok) throw new ApiError(400, `${def.label}: not found in the connected Xero organisation`);
    }
    updates[key] = value || null;
  }

  await db.transaction(async (trx) => {
    for (const [key, value] of Object.entries(updates)) {
      await trx('settings').where({ key }).delete();
      if (value) await trx('settings').insert({ key, value });
    }
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'XERO_ACCOUNT_SETTINGS_UPDATED',
      entity_type: 'xero_connection',
      entity_id: 0,
      meta: JSON.stringify(updates),
      ip_address: req.ip || null
    });
  });
  res.json({ success: true, message: 'Xero accounts saved', data: updates });
});

// GET /xero/diagnostics — what our app can and cannot reach in the connected
// organisation. GET requests only; nothing is written to Xero.
export const getXeroDiagnostics = catchAsync(async (req, res) => {
  const { connection } = await getValidAccessToken();
  const fresh = await getStoredConnection();
  // Bank check: the first bank account ticked for import (Bank Transactions tab)
  const bankId = (await db('xero_import_accounts').first('xero_account_id'))?.xero_account_id || null;

  const today = toYmd(new Date());
  const from = toYmd(new Date(Date.now() - 90 * 864e5));
  const checks = [
    { name: 'Chart of accounts', path: '/Accounts', searchParams: { where: 'Type=="BANK"' } },
    { name: 'Contacts', path: '/Contacts', searchParams: { page: '1' } },
    { name: 'Invoices', path: '/Invoices', searchParams: { page: '1' } },
    { name: 'Payments', path: '/Payments', searchParams: { page: '1' } },
    bankId
      ? { name: 'Bank transactions (rent account)', path: '/BankTransactions', searchParams: { where: `BankAccount.AccountID==Guid("${bankId}")`, page: '1' } }
      : { name: 'Bank transactions (rent account)', skip: 'Choose the rent bank account first' },
    bankId
      ? { name: 'Bank statement lines', path: '/Reports/BankStatement', searchParams: { bankAccountID: bankId, fromDate: from, toDate: today }, expectBlocked: true }
      : { name: 'Bank statement lines', skip: 'Choose the rent bank account first', expectBlocked: true }
  ];

  const results = [];
  for (const c of checks) {
    if (c.skip) { results.push({ name: c.name, ok: null, http_status: null, message: c.skip }); continue; }
    const r = await xeroApiRaw('GET', c.path, { searchParams: c.searchParams });
    results.push({
      name: c.name,
      ok: r.ok,
      http_status: r.status,
      message: r.ok
        ? 'Available'
        : r.status === 401 || r.status === 403
          ? (c.expectBlocked ? 'Not enabled for our app by Xero (expected)' : 'Not permitted — reconnect Xero to grant this permission')
          : `Xero answered HTTP ${r.status}`
    });
  }

  res.json({
    success: true,
    data: {
      organisation: connection.tenant_name,
      scopes: String(fresh?.scopes || '').split(/\s+/).filter(Boolean),
      missing_scopes: missingXeroScopes(fresh?.scopes),
      checks: results
    }
  });
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
    const fromDate = toYmd(new Date(today.getFullYear(), today.getMonth(), 1));
    const toDate = toYmd(today);
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

// ── Rent invoices in Xero (rent cycle phase 2) ──────────────────────────────

const SETTING_RENT_INVOICES_LAST = 'xeroRentInvoicesLast';

const saveSetting = async (trx, key, value) => {
  await trx('settings').where({ key }).delete();
  if (value !== null && value !== undefined && value !== '') await trx('settings').insert({ key, value: String(value) });
};

// POST /xero/rent-invoices/push — create the missing internal rent invoices.
export const pushXeroRentInvoices = catchAsync(async (req, res) => {
  const result = await pushRentInvoices(req.user.id);
  await db.transaction(async (trx) => {
    await saveSetting(trx, SETTING_RENT_INVOICES_LAST, JSON.stringify({ ...result, at: new Date().toISOString() }));
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'XERO_RENT_INVOICES_PUSHED',
      entity_type: 'xero_connection',
      entity_id: 0,
      meta: JSON.stringify(result),
      ip_address: req.ip || null
    });
  });
  res.json({
    success: true,
    message: `Rent invoices in Xero: ${result.created} created, ${result.voided} voided, ${result.failed} failed`
      + (result.attention ? `, ${result.attention} need attention` : '')
      + (result.skipped_no_codes?.length
        ? `. Skipped (set the block code and flat number on the property): ${result.skipped_no_codes.join(', ')}`
        : ''),
    data: result
  });
});

// GET /xero/rent-invoices/settings
export const getXeroRentInvoiceSettings = catchAsync(async (req, res) => {
  const last = (await db('settings').where({ key: SETTING_RENT_INVOICES_LAST }).first())?.value;
  const counts = await db('xero_rent_invoices').select('status').count('* as n').groupBy('status');
  res.json({
    success: true,
    data: {
      invoices_from: await getInvoicesFrom(),
      last: last ? JSON.parse(last) : null,
      counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]))
    }
  });
});

// PUT /xero/rent-invoices/settings { invoices_from: 'YYYY-MM-DD' }
export const saveXeroRentInvoiceSettings = catchAsync(async (req, res) => {
  const from = String(req.body?.invoices_from || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || Number.isNaN(new Date(from).getTime())) {
    throw new ApiError(400, 'Choose the date to create Xero rent invoices from');
  }
  await db.transaction(async (trx) => {
    await saveSetting(trx, SETTING_INVOICES_FROM, from);
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'XERO_RENT_INVOICES_FROM_SET',
      entity_type: 'xero_connection',
      entity_id: 0,
      meta: JSON.stringify({ invoices_from: from }),
      ip_address: req.ip || null
    });
  });
  res.json({ success: true, message: 'Saved', data: { invoices_from: from } });
});
