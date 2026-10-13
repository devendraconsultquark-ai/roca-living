import crypto from 'crypto';
import db from '../config/db.js';
import logger from '../utils/logger.js';
import { ApiError } from './ApiError.js';
import { encryptSecret, decryptSecret } from './secretBox.js';

// Thin Xero OAuth 2.0 + Accounting API client. Deliberately built on global
// fetch rather than the xero-node SDK: we only need a handful of endpoints and
// the SDK pulls in a very large dependency tree.
//
// Nothing in this module ever logs a token, an auth code, or the client secret.

const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const CONNECTIONS_URL = 'https://api.xero.com/connections';
const API_BASE = 'https://api.xero.com/api.xro/2.0';

// Xero apps created after 2 March 2026 must use granular scopes — the broad
// accounting.transactions / accounting.reports.read are rejected with
// "invalid_scope" (same constraint the rocaem integration hit):
//   settings.read            → bank accounts and the chart of accounts
//   banktransactions         → money in / out (read; write for later phases)
//   contacts                 → tenant and landlord contacts created by Roca Living
//   invoices                 → internal rent invoices and landlord bills
//   payments                 → rent paid against those invoices
//   reports.banksummary.read → live account balances in Settings
// Bank statement lines (accounting.reports.bankstatement.read /
// finance.bankstatementsplus.read) are not granted to our app by Xero.
// Adding a scope later requires the admin to reconnect Xero.
export const XERO_SCOPE_LIST = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'accounting.settings.read',
  'accounting.banktransactions',
  'accounting.contacts',
  'accounting.invoices',
  'accounting.payments',
  'accounting.reports.banksummary.read'
];
export const XERO_SCOPES = XERO_SCOPE_LIST.join(' ');

// Scopes we ask for that the stored connection was not granted (it was made
// before they were added) — the admin must reconnect Xero to get them.
export const missingXeroScopes = (granted) => {
  const have = new Set(String(granted || '').split(/\s+/).filter(Boolean));
  return XERO_SCOPE_LIST.filter((s) => !have.has(s));
};

export const isXeroConfigured = () =>
  Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET && process.env.XERO_REDIRECT_URI);

const requireConfig = () => {
  if (!isXeroConfigured()) {
    throw new ApiError(500, 'Xero is not configured on this server (missing XERO_CLIENT_ID, XERO_CLIENT_SECRET or XERO_REDIRECT_URI)');
  }
};

export const buildAuthorizeUrl = (state) => {
  requireConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.XERO_CLIENT_ID,
    redirect_uri: process.env.XERO_REDIRECT_URI,
    scope: XERO_SCOPES,
    state
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
};

export const createOAuthState = () => crypto.randomBytes(24).toString('base64url');

const basicAuthHeader = () =>
  'Basic ' + Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64');

const postToken = async (bodyParams) => {
  requireConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(bodyParams).toString(),
    signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    // Body may name the failure (invalid_grant etc.) but never contains a usable
    // secret; still, only the error code is surfaced.
    let code = 'unknown_error';
    try {
      const body = await res.json();
      code = body.error || code;
    } catch {
      /* non-JSON error body */
    }
    logger.error(`Xero token request failed: HTTP ${res.status} (${code})`);
    const err = new ApiError(502, `Xero rejected the authorisation (${code})`);
    err.xeroErrorCode = code;
    throw err;
  }

  return res.json();
};

export const exchangeCodeForTokens = (code) =>
  postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.XERO_REDIRECT_URI
  });

export const refreshAccessToken = (refreshToken) =>
  postToken({ grant_type: 'refresh_token', refresh_token: refreshToken });

// Best-effort revocation on disconnect so access really ends at Xero's side and
// not just in our database. Failure is logged, never fatal.
export const revokeRefreshToken = async (refreshToken) => {
  try {
    const res = await fetch('https://identity.xero.com/connect/revocation', {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ token: refreshToken }).toString(),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) logger.warn(`Xero token revocation returned HTTP ${res.status}`);
  } catch (err) {
    logger.warn(`Xero token revocation failed: ${err.message}`);
  }
};

// Organisations the authorising user granted us access to.
export const fetchConnections = async (accessToken) => {
  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) {
    logger.error(`Xero connections lookup failed: HTTP ${res.status}`);
    throw new ApiError(502, 'Could not read the Xero organisation list');
  }
  return res.json();
};

export const getStoredConnection = () =>
  db('xero_connections').whereIn('status', ['active', 'needs_reauth']).orderBy('id', 'desc').first();

export const saveTokenSet = async (connectionId, tokenSet) => {
  const updates = {
    access_token: encryptSecret(tokenSet.access_token),
    access_expires_at: new Date(Date.now() + (Number(tokenSet.expires_in) || 1800) * 1000),
    status: 'active',
    updated_at: db.fn.now()
  };
  // Xero rotates refresh tokens on every exchange — the new one must be stored
  // or the connection dies at the next refresh.
  if (tokenSet.refresh_token) {
    updates.refresh_token = encryptSecret(tokenSet.refresh_token);
  }
  if (tokenSet.scope) {
    updates.scopes = String(tokenSet.scope).slice(0, 500);
  }
  await db('xero_connections').where('id', connectionId).update(updates);
};

// Returns { connection, accessToken }, refreshing first if the token is close to
// expiry. Throws 409 when the connection needs a fresh authorisation.
export const getValidAccessToken = async () => {
  const connection = await getStoredConnection();
  if (!connection) {
    throw new ApiError(409, 'Xero is not connected');
  }

  const expiresAt = connection.access_expires_at ? new Date(connection.access_expires_at).getTime() : 0;
  const stillValid = expiresAt > Date.now() + 60_000; // 60s safety margin
  if (stillValid) {
    return { connection, accessToken: decryptSecret(connection.access_token) };
  }

  try {
    const tokenSet = await refreshAccessToken(decryptSecret(connection.refresh_token));
    await saveTokenSet(connection.id, tokenSet);
    const refreshed = await db('xero_connections').where('id', connection.id).first();
    return { connection: refreshed, accessToken: tokenSet.access_token };
  } catch (err) {
    logger.error(`Xero token refresh failed for tenant ${connection.tenant_id}: ${err.message}`);
    // Only a rejected refresh token (invalid_grant) really ends the connection.
    // A network blip or Xero outage must not force a fresh sign-in, which would
    // put the account owner through Xero's email check again.
    if (err.xeroErrorCode !== 'invalid_grant') {
      throw new ApiError(502, 'Xero is not reachable right now — please try again shortly');
    }
    await db('xero_connections').where('id', connection.id).update({ status: 'needs_reauth' });
    throw new ApiError(409, 'The Xero connection has expired — please reconnect');
  }
};

// Xero's error text, trimmed for the log (error bodies never carry tokens).
const xeroErrorText = async (res) => {
  try {
    return (await res.text()).replace(/\s+/g, ' ').slice(0, 400);
  } catch {
    return '';
  }
};

// One request to the connected organisation. Returns { status, ok, body } and
// never throws on an HTTP error — callers that only want data use xeroApiGet.
// `base` defaults to the Accounting API; a full URL can be passed as `path`.
export const xeroApiRaw = async (method, path, { searchParams = {}, body } = {}) => {
  const { connection, accessToken } = await getValidAccessToken();
  const query = new URLSearchParams(searchParams).toString();
  const url = `${/^https:\/\//.test(path) ? path : `${API_BASE}${path}`}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-Tenant-Id': connection.tenant_id,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000)
  });
  if (res.ok) return { status: res.status, ok: true, body: await res.json().catch(() => null) };
  return { status: res.status, ok: false, body: null, error: await xeroErrorText(res) };
};

// Any Accounting API request; throws an ApiError when Xero refuses it.
export const xeroApiRequest = async (method, path, { searchParams = {}, body } = {}) => {
  const r = await xeroApiRaw(method, path, { searchParams, body });
  if (r.status === 429) {
    logger.warn('Xero API rate limit hit');
    throw new ApiError(429, 'Xero rate limit reached — please try again shortly');
  }
  if (!r.ok) {
    logger.error(`Xero API ${method} ${path} failed: HTTP ${r.status} ${r.error || ''}`);
    throw new ApiError(502, 'Xero request failed');
  }
  return r.body;
};

// GET against the Accounting API for the connected organisation.
export const xeroApiGet = (path, searchParams = {}) => xeroApiRequest('GET', path, { searchParams });
