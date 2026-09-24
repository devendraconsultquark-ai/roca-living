# Xero Integration — Design

**Status:** X1 (Connect) **built 22 Jul 2026**; X2–X4 not yet built
**Companion to:** `SPEC-COVERAGE.md` §10 (E1), §13 (decisions)
**Context:** ROCA runs its money through Xero — landlord payouts leave the Xero-connected bank
account. The client is non-technical; decisions here were taken on their behalf.
**Rent flow confirmed 22 Jul 2026:** tenants pay rent directly into ROCA's account; the platform
imports each transaction as income, auto-reconciles it to its tenancy/property where the match is
unambiguous, and queues the rest for manual reconciliation.

## 1. Principle

- **Our platform** is the source of truth for *property management*: landlords, properties,
  tenancies, rent schedules, statements, compliance, maintenance.
- **Xero** is the source of truth for *money*: actual bank transactions, company books, VAT.
- The integration is a **matching layer** between the two. We never re-implement accounting, bank
  feeds, or VAT — we read Xero's records and reconcile them against what our system expected.

This turns the deck's biggest unbuilt module (bank reconciliation) from a from-scratch product
into an API integration.

## 2. What it unlocks (deck screens → honest data)

| Deck screen | How Xero powers it |
|---|---|
| Bank Reconciliation (p.25) | Pull `BankTransactions` from the connected bank account; match against expected rent (`rent_schedules`) and outgoing payouts (statements). The unmatched list *is* the reconciliation queue. |
| Client Account Balance — sidebar tile, dashboard, accounting (p.1, 24) | Live balance of the Xero bank account via the Accounting API — replaces the Management Fee Account stand-in with the spec's real number. |
| Payments Received (p.21) | Confirmed rent matches write `rent_payments` automatically (today they are manual entries). |
| Expenses / suppliers (p.23) | Pull Xero bills (ACCPAY invoices) per contractor; optional tracking categories per property later. |
| VAT (p.26) | Xero owns MTD VAT returns. We show a summary card + deep link into Xero — no in-house VAT engine, ever. |

## 3. Technical shape

**Auth.** Standard Xero OAuth 2.0 app (free tier, integration type **Web app** — the server is a
confidential client holding the secret) using `xero-node`. Admin connects once from Settings →
"Connect Xero"; we store the token set encrypted and refresh on use.

- Env: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`.
- **Registered redirect URI (dev):** `http://localhost:9009/api/v1/xero/callback` — Xero permits
  plain http only for `localhost`. Production URI to be added on the same app once the live API
  hostname is fixed; Xero allows multiple and they can be edited any time.
- **Callback route contract:** a dedicated `xeroRoutes.js` mounted at `/api/v1/xero` (matching the
  one-router-per-domain pattern in `app.js`) exposes `GET /connect`, `GET /callback`,
  `POST /sync`, `DELETE /disconnect`. The browser lands on `/callback`; the **server** exchanges
  the code (the secret never reaches the browser) and then 302s back to the admin Settings page.
- Refresh tokens are rolling 60-day; the daily sync keeps them alive.

**New tables.**

| Table | Purpose |
|---|---|
| `xero_connections` | tenant_id, org name, encrypted token set, connected_by, last_synced_at |
| `xero_bank_transactions` | imported cache: xero_id (unique), bank_account, date, amount, direction, reference, contact_name, raw JSON, match_status (`unmatched` / `matched` / `ignored`) |
| `xero_matches` | bank_txn_id → target (`rent_schedule` / `statement` / `manual`), target_id, matched_by, matched_at |

**Sync.** "Sync now" button + daily scheduled pull of bank transactions since the last cursor
(If-Modified-Since). Xero limits (60 calls/min, 5,000/day) are far above our needs.

**Matching engine v1 — deterministic, no AI.** Every inbound transaction is imported as income.
Where exactly one candidate fits (amount = rent due in the date window, and/or payer reference
identifies the tenant/tenancy), it is **auto-reconciled** to that tenancy → property and written
as a `rent_payment`. Everything else stays in the **Unreconciled queue**, where the admin assigns
it to a tenancy/property in one click (or marks it non-rent income). Outbound transactions match
against statements/payouts the same way. Honest-UI rule: we never auto-match on weak signals —
ambiguity always goes to the queue, so no payment is ever attributed to the wrong property.

**Match-rate booster (recommended):** give every tenancy a unique payment reference (tenancy
references already exist) and have tenants put it on their standing order. Referenced payments
then auto-match deterministically; the manual queue shrinks to legacy/unreferenced payments,
partial payments, and overpayments (all deliberately manual in v1).

**Push (optional, later).** Create fee invoices (ACCREC) in Xero when statements are approved, so
ROCA's books show fee income without re-keying.

## 4. Build phases

| Phase | Scope | Depends on |
|---|---|---|
| **X1 — Connect** ✅ | OAuth flow in Settings, encrypted token storage, connected org + bank accounts with balances, disconnect with token revocation | Xero app credentials (§5) |
| **X2 — Pull** | Bank-transaction import + raw feed screen; `xero_bank_transactions` cache; daily sync | X1 |
| **X3 — Match** | Matching engine + Reconciliation screen (deck p.25); confirmed matches write rent payments / statement paid | X2 |
| **X4 — Push + VAT** | Fee invoices to Xero; VAT summary card with deep links. **Needs a reconnect** — X1 requested read-only scopes | X1 |

### X1 as built (22 Jul 2026)

- `phase17_xero_connection.js` → `xero_connections` (tenant, encrypted token pair, expiry, scopes,
  status `active`/`needs_reauth`, connected_by, last_synced_at).
- `utils/secretBox.js` — AES-256-GCM encryption for stored credentials, key derived from
  `JWT_SECRET` (no second secret to distribute; rotating it forces a harmless reconnect).
- `utils/xero.js` — OAuth + Accounting API client on global `fetch` (no `xero-node`: we need a
  handful of endpoints and the SDK is a very large dependency). Handles refresh-token **rotation**,
  marks the connection `needs_reauth` when refresh fails, maps HTTP 429 to a clear error, and never
  logs a token, auth code or secret.
- `xeroController.js` / `xeroRoutes.js` at `/api/v1/xero` — `status`, `connect`, `callback`,
  `bank-accounts`, `disconnect` (admin-only). CSRF-protected by a random `state` in an httpOnly
  SameSite=Lax cookie, verified on callback; the code exchange happens server-side so the client
  secret never reaches the browser; failures redirect back to Settings with a readable reason.
- Admin `XeroConnection` panel in Settings: connect/reconnect, organisation name, bank accounts
  with balances and a total, refresh, disconnect. Balances come from the **Bank Summary report**
  (the Accounts endpoint has no balance); an unreadable balance shows "—", never a fake £0.00.

**Verified:** phase17 migration applied; `/status` returns `configured:true, connected:false`;
`/connect` 302s to `login.xero.com` with the registered redirect URI, correct scopes and a 32-char
state (httpOnly cookie set); a mismatched state is rejected. **Not yet exercised:** a real
authorisation round trip — that needs someone to click Connect and approve against a Xero org.

## 5. Needed before building

1. **Rent flow — resolved 22 Jul 2026:** tenants pay rent into ROCA's account directly. The
   import → auto-match → manual-reconcile flow in §3 is the confirmed model.
2. **Xero developer app** at developer.xero.com → client id/secret into `.env`.
3. **Access to ROCA's Xero organisation** (or start against Xero's Demo Company sandbox — X1–X3
   are fully buildable against the sandbox with no client involvement).

## 6. Risks & notes

- **Client money compliance is not solved by Xero.** If ROCA holds tenant/landlord funds, Client
  Money Protection membership and segregated accounts are a *business* obligation — flag to the
  client separately; the software only evidences it.
- Token loss (60-day unused refresh expiry) → daily sync prevents; surface a "reconnect" banner
  in Settings if a refresh ever fails.
- Multi-org: schema supports it (`tenant_id` on everything) but v1 targets one organisation.
- Develop against the Xero Demo Company before touching the real org.
