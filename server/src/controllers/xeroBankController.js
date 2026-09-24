import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { getStoredConnection, xeroApiGet } from '../utils/xero.js';
import { allocateTenancyPayments } from '../utils/rentAllocation.js';

// ─────────────────────────────────────────────────────────────────────────────
// Xero bank transactions → ROCA (same model as the rocaem reconciliation):
//   1. admin ticks which Xero bank accounts to import + an import start date
//   2. sync pulls money in and money out from those accounts (Sync now + daily)
//   3. auto-match only when certain:
//        in:  a payer linked before to a tenancy AND amount = that tenancy's
//             next rent due  → recorded as a rent payment
//        out: a payee linked before to a landlord AND amount = one unpaid
//             statement payout (or all of them together) → statements paid
//   4. everything else is reconciled by the admin to a tenant (rent),
//      landlord (payout) or property (expense), or ignored; Undo reverses it
// ─────────────────────────────────────────────────────────────────────────────

const SETTING_IMPORT_FROM = 'xeroImportFrom';
const PAGE_SIZE = 100; // Xero returns up to 100 bank transactions per page
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pad2 = (n) => String(n).padStart(2, '0');
const localYmd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const getImportFrom = async () => {
  const row = await db('settings').where({ key: SETTING_IMPORT_FROM }).first();
  if (row && isYmd(row.value)) return row.value;
  const d = new Date();
  d.setDate(d.getDate() - 90); // default: last 90 days
  return localYmd(d);
};

// Xero JSON dates are "/Date(1719273600000+0000)/"; DateString is ISO when present.
export const parseXeroDate = (bt) => {
  if (typeof bt.DateString === 'string' && bt.DateString.length >= 10) return bt.DateString.slice(0, 10);
  const m = /\/Date\((\d+)/.exec(bt.Date || '');
  if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);
  return null;
};

// ── Import settings ─────────────────────────────────────────────────────────

// GET /xero/import-settings
export const getImportSettings = catchAsync(async (req, res) => {
  const accounts = await db('xero_import_accounts').select('xero_account_id as account_id', 'name');
  const connection = await getStoredConnection();
  res.json({
    success: true,
    data: {
      accounts,
      import_from: await getImportFrom(),
      last_synced_at: connection?.last_synced_at ? new Date(connection.last_synced_at).toISOString() : null
    }
  });
});

// PUT /xero/import-settings  { accounts: [{ account_id, name }], import_from: 'YYYY-MM-DD' }
export const saveImportSettings = catchAsync(async (req, res) => {
  const { accounts, import_from } = req.body;
  if (!Array.isArray(accounts)) throw new ApiError(400, 'accounts must be a list');
  if (accounts.some((a) => !a || !GUID_RE.test(String(a.account_id || '')))) {
    throw new ApiError(400, 'Invalid Xero account id');
  }
  if (import_from !== undefined && !isYmd(import_from)) throw new ApiError(400, 'import_from must be YYYY-MM-DD');

  await db.transaction(async (trx) => {
    await trx('xero_import_accounts').delete();
    if (accounts.length) {
      await trx('xero_import_accounts').insert(accounts.map((a) => ({
        xero_account_id: a.account_id,
        name: String(a.name || '').slice(0, 255) || null
      })));
    }
    if (import_from) {
      const existing = await trx('settings').where({ key: SETTING_IMPORT_FROM }).first();
      if (existing) await trx('settings').where({ key: SETTING_IMPORT_FROM }).update({ value: import_from, updated_at: trx.fn.now() });
      else await trx('settings').insert({ key: SETTING_IMPORT_FROM, value: import_from });
    }
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'XERO_IMPORT_SETTINGS_UPDATED',
      entity_type: 'xero_connection',
      entity_id: 0,
      meta: JSON.stringify({ accounts: accounts.map((a) => a.name || a.account_id), import_from: import_from || null }),
      ip_address: req.ip || null
    });
  });

  res.json({ success: true, message: 'Import settings saved' });
});

// ── Sync ────────────────────────────────────────────────────────────────────

const fetchAccountTransactions = async (accountId, fromYmd) => {
  const [y, m, d] = fromYmd.split('-').map(Number);
  const where = `BankAccount.AccountID==Guid("${accountId}") AND Date>=DateTime(${y},${pad2(m)},${pad2(d)})`;
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const payload = await xeroApiGet('/BankTransactions', { where, page: String(page) });
    const list = payload?.BankTransactions || [];
    all.push(...list);
    if (list.length < PAGE_SIZE) break;
  }
  return all;
};

// Store Xero bank transactions once each. Deleted/voided ones are skipped (and
// removed if still unreconciled). Returns the ids of newly staged rows.
export const stageXeroTransactions = async (list, fallbackAccountName = null) => {
  const ids = list.map((bt) => bt.BankTransactionID).filter(Boolean);
  const existing = ids.length
    ? await db('xero_bank_transactions').whereIn('xero_transaction_id', ids).select('xero_transaction_id', 'status')
    : [];
  const known = new Map(existing.map((r) => [r.xero_transaction_id, r.status]));
  const staged = [];

  for (const bt of list) {
    const id = bt.BankTransactionID;
    if (!id) continue;
    const dead = ['DELETED', 'VOIDED'].includes(String(bt.Status || '').toUpperCase());
    if (dead) {
      if (known.get(id) === 'unreconciled') await db('xero_bank_transactions').where({ xero_transaction_id: id }).delete();
      continue;
    }
    if (known.has(id)) continue;

    const date = parseXeroDate(bt);
    const amount = round2(Math.abs(parseFloat(bt.Total) || 0));
    if (!date || amount <= 0) continue;

    const type = String(bt.Type || '').toUpperCase();
    const [rowId] = await db('xero_bank_transactions').insert({
      xero_transaction_id: id,
      xero_account_id: bt.BankAccount?.AccountID || null,
      account_name: bt.BankAccount?.Name || fallbackAccountName,
      xero_type: type.slice(0, 40) || null,
      direction: type.startsWith('RECEIVE') ? 'in' : 'out',
      date,
      amount: amount.toFixed(2),
      reference: String(bt.Reference || bt.LineItems?.[0]?.Description || '').slice(0, 500) || null,
      contact_id: bt.Contact?.ContactID || null,
      contact_name: bt.Contact?.Name ? String(bt.Contact.Name).slice(0, 255) : null
    });
    staged.push(rowId);
  }
  return staged;
};

// Full sync: import from every ticked account, then auto-match the new rows.
export const runXeroSync = async (actorId = null) => {
  const connection = await getStoredConnection();
  if (!connection || connection.status !== 'active') throw new ApiError(409, 'Xero is not connected');
  const accounts = await db('xero_import_accounts').select('xero_account_id', 'name');
  if (!accounts.length) throw new ApiError(400, 'Choose which Xero bank accounts to import in Settings → Xero');

  const fromYmd = await getImportFrom();
  let fetched = 0;
  const staged = [];
  for (const acc of accounts) {
    const list = await fetchAccountTransactions(acc.xero_account_id, fromYmd);
    fetched += list.length;
    staged.push(...await stageXeroTransactions(list, acc.name));
  }

  const actor = actorId || connection.connected_by || null;
  let autoMatched = 0;
  for (const id of staged) {
    try {
      if (await autoMatch(id, actor)) autoMatched++;
    } catch (err) {
      logger.error(`[XeroSync] Auto-match failed for staged row ${id}: ${err.message}`);
    }
  }

  await db('xero_connections').where('id', connection.id).update({ last_synced_at: db.fn.now() });
  return { fetched, imported: staged.length, auto_matched: autoMatched };
};

// POST /xero/sync
export const syncXero = catchAsync(async (req, res) => {
  const result = await runXeroSync(req.user.id);
  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'XERO_SYNC',
    entity_type: 'xero_connection',
    entity_id: 0,
    meta: JSON.stringify(result),
    ip_address: req.ip || null
  });
  res.json({
    success: true,
    message: `${result.imported} new transaction(s) imported, ${result.auto_matched} matched automatically`,
    data: result
  });
});

// ── Matching building blocks ────────────────────────────────────────────────

const oldestOpenSchedule = (trx, tenancyId) => trx('rent_schedules')
  .where('tenancy_id', tenancyId)
  .whereIn('status', ['due', 'overdue', 'partial'])
  .orderBy([{ column: 'due_date' }, { column: 'id' }])
  .first();

// Same writes as "Record Rent Payment" (tenancyController.recordRentPayment).
const recordRent = async (trx, row, tenancyId, actorId) => {
  const tenancy = await trx('tenancies').where('id', tenancyId).first();
  if (!tenancy) throw new ApiError(404, 'Tenancy not found');
  const property = await trx('properties').where('id', tenancy.property_id).first();
  const amount = parseFloat(row.amount).toFixed(2);

  const reference = `Xero: ${row.reference || row.contact_name || row.xero_transaction_id}`.slice(0, 255);

  // Applied to rent months oldest first; part payments stay owed, surplus is credit.
  const [paymentId] = await trx('rent_payments').insert({
    tenancy_id: tenancyId,
    schedule_id: null,
    received_at: localYmd(row.date),
    amount,
    method: 'bank_transfer',
    reference,
    reconciled: 0,
    reconciled_by: actorId,
    notes: 'Imported from Xero'
  });
  await allocateTenancyPayments(trx, tenancyId);
  const schedule = (await trx('rent_payments').where('id', paymentId).first()).schedule_id;

  const [ledgerId] = await trx('transactions').insert({
    type: 'rent_in',
    property_id: tenancy.property_id,
    landlord_id: property?.landlord_id || null,
    tenancy_id: tenancyId,
    amount,
    transaction_date: localYmd(row.date),
    reconciled: schedule ? 1 : 0,
    created_by: actorId,
    description: `Rent received via Xero for tenancy ID ${tenancyId} (${reference})`
  });
  return { rent_payment_id: paymentId, ledger_transaction_id: ledgerId, property_id: tenancy.property_id, landlord_id: property?.landlord_id || null };
};

const payStatements = async (trx, row, statementIds) => {
  const statements = await trx('landlord_statements').whereIn('id', statementIds).select('id', 'status', 'paid_at', 'landlord_id');
  if (statements.length !== statementIds.length) throw new ApiError(404, 'Statement not found');
  if (statements.some((s) => s.status === 'paid')) throw new ApiError(400, 'A selected statement is already paid');
  await trx('landlord_statements').whereIn('id', statementIds).update({ status: 'paid', paid_at: localYmd(row.date) });
  return statements.map((s) => ({ id: s.id, prev_status: s.status }));
};

const rememberContact = async (trx, contactId, kind, target, actorId) => {
  if (!contactId) return;
  const values = kind === 'tenant' ? { tenancy_id: target, landlord_id: null } : { landlord_id: target, tenancy_id: null };
  const existing = await trx('xero_contact_links').where({ xero_contact_id: contactId, kind }).first();
  if (existing) await trx('xero_contact_links').where('id', existing.id).update(values);
  else await trx('xero_contact_links').insert({ xero_contact_id: contactId, kind, ...values, created_by: actorId });
};

// Returns true when the row was matched automatically.
export const autoMatch = (rowId, actorId) => db.transaction(async (trx) => {
  const row = await trx('xero_bank_transactions').where('id', rowId).forUpdate().first();
  if (!row || row.status !== 'unreconciled' || !row.contact_id) return false;

  if (row.direction === 'in') {
    const link = await trx('xero_contact_links').where({ xero_contact_id: row.contact_id, kind: 'tenant' }).first();
    if (!link?.tenancy_id) return false;
    const tenancy = await trx('tenancies').where('id', link.tenancy_id).whereIn('status', ['active', 'notice']).first();
    if (!tenancy) return false;
    const next = await oldestOpenSchedule(trx, tenancy.id);
    // Certain only when it exactly settles the oldest open month; anything else → admin decides.
    if (!next || round2(next.amount - (next.paid_amount || 0)) !== round2(row.amount)) return false;

    const r = await recordRent(trx, row, tenancy.id, actorId);
    await trx('xero_bank_transactions').where('id', rowId).update({
      status: 'reconciled', reconciled_as: 'tenant_rent', tenancy_id: tenancy.id, property_id: r.property_id,
      landlord_id: r.landlord_id, rent_payment_id: r.rent_payment_id, ledger_transaction_id: r.ledger_transaction_id,
      auto_matched: true, reconciled_by: actorId, reconciled_at: trx.fn.now()
    });
    return true;
  }

  const link = await trx('xero_contact_links').where({ xero_contact_id: row.contact_id, kind: 'landlord' }).first();
  if (!link?.landlord_id) return false;
  const unpaid = await trx('landlord_statements')
    .where('landlord_id', link.landlord_id)
    .whereIn('status', ['draft', 'sent'])
    .orderBy('period_end', 'asc')
    .select('id', 'net_paid');
  const exact = unpaid.filter((s) => round2(s.net_paid) === round2(row.amount));
  let ids = null;
  if (exact.length === 1) ids = [exact[0].id];
  else if (exact.length === 0 && unpaid.length > 1 && round2(unpaid.reduce((a, s) => a + parseFloat(s.net_paid), 0)) === round2(row.amount)) {
    ids = unpaid.map((s) => s.id);
  }
  if (!ids) return false;

  const meta = await payStatements(trx, row, ids);
  await trx('xero_bank_transactions').where('id', rowId).update({
    status: 'reconciled', reconciled_as: 'landlord_payout', landlord_id: link.landlord_id,
    link_meta: JSON.stringify(meta), auto_matched: true, reconciled_by: actorId, reconciled_at: trx.fn.now()
  });
  return true;
});

// ── List with suggestions ───────────────────────────────────────────────────

const surname = (name) => {
  const parts = String(name || '').toUpperCase().replace(/[^A-Z\s-]/g, ' ').split(/\s+/).filter((p) => p.length >= 3);
  return parts.length ? parts[parts.length - 1] : null;
};

const buildSuggestions = async (rows) => {
  const open = rows.filter((r) => r.status === 'unreconciled');
  if (!open.length) return {};

  const tenancies = await db('tenancies')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .leftJoin('tenants', function () {
      this.on('tenants.tenancy_id', '=', 'tenancies.id').andOn('tenants.is_lead_tenant', '=', db.raw('1'));
    })
    .whereIn('tenancies.status', ['active', 'notice'])
    .select('tenancies.id', 'tenancies.rent_pcm', 'tenants.name as tenant_name', 'properties.address_line1');
  const landlords = await db('users').where('role', 'LANDLORD').select('id', 'name');
  const contactIds = [...new Set(open.map((r) => r.contact_id).filter(Boolean))];
  const links = contactIds.length ? await db('xero_contact_links').whereIn('xero_contact_id', contactIds) : [];

  const out = {};
  for (const r of open) {
    // Whole words only, so "NORTH" does not match inside "ZZNORTH".
    const words = new Set(`${r.contact_name || ''} ${r.reference || ''}`.toUpperCase().split(/[^A-Z0-9-]+/));
    if (r.direction === 'in') {
      const link = links.find((l) => l.xero_contact_id === r.contact_id && l.kind === 'tenant');
      let t = link ? tenancies.find((x) => x.id === link.tenancy_id) : null;
      let reason = t ? 'Known payer' : null;
      if (!t) {
        const byName = tenancies.filter((x) => { const s = surname(x.tenant_name); return s && words.has(s); });
        if (byName.length === 1) { t = byName[0]; reason = 'Payer name matches tenant'; }
      }
      if (!t) {
        const byAmount = tenancies.filter((x) => round2(x.rent_pcm) === round2(r.amount));
        if (byAmount.length === 1) { t = byAmount[0]; reason = 'Amount matches rent'; }
      }
      if (t) out[r.id] = { as: 'tenant_rent', tenancy_id: t.id, label: `${t.tenant_name || 'Tenant'} · ${t.address_line1}`, reason };
    } else {
      const link = links.find((l) => l.xero_contact_id === r.contact_id && l.kind === 'landlord');
      let l = link ? landlords.find((x) => x.id === link.landlord_id) : null;
      let reason = l ? 'Known payee' : null;
      if (!l) {
        const byName = landlords.filter((x) => { const s = surname(x.name); return s && words.has(s); });
        if (byName.length === 1) { l = byName[0]; reason = 'Payee name matches landlord'; }
      }
      if (l) out[r.id] = { as: 'landlord_payout', landlord_id: l.id, label: l.name, reason };
    }
  }
  return out;
};

// GET /xero/transactions?status=unreconciled|reconciled|ignored&direction=in|out
export const listBankTransactions = catchAsync(async (req, res) => {
  const status = ['unreconciled', 'reconciled', 'ignored'].includes(req.query.status) ? req.query.status : 'unreconciled';
  let q = db('xero_bank_transactions as x')
    .leftJoin('tenancies', 'x.tenancy_id', 'tenancies.id')
    .leftJoin('tenants', function () {
      this.on('tenants.tenancy_id', '=', 'x.tenancy_id').andOn('tenants.is_lead_tenant', '=', db.raw('1'));
    })
    .leftJoin('properties', 'x.property_id', 'properties.id')
    .leftJoin('users as landlords', 'x.landlord_id', 'landlords.id')
    .where('x.status', status)
    .select('x.*', 'tenants.name as tenant_name', 'properties.address_line1 as property_address', 'landlords.name as landlord_name')
    .orderBy([{ column: 'x.date', order: 'desc' }, { column: 'x.id', order: 'desc' }])
    .limit(500);
  if (['in', 'out'].includes(req.query.direction)) q = q.where('x.direction', req.query.direction);
  const rows = await q;

  const counts = await db('xero_bank_transactions').select('status').count('* as n').groupBy('status');
  const suggestions = await buildSuggestions(rows);
  const connection = await getStoredConnection();

  res.json({
    success: true,
    data: {
      counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
      last_synced_at: connection?.last_synced_at ? new Date(connection.last_synced_at).toISOString() : null,
      connected: Boolean(connection) && connection.status === 'active',
      rows: rows.map((r) => ({
        id: r.id,
        date: localYmd(r.date),
        direction: r.direction,
        amount: round2(r.amount),
        reference: r.reference,
        contact_name: r.contact_name,
        account_name: r.account_name,
        status: r.status,
        reconciled_as: r.reconciled_as,
        auto_matched: !!r.auto_matched,
        linked_to: r.reconciled_as === 'tenant_rent'
          ? `${r.tenant_name || 'Tenant'} · ${r.property_address || ''}`
          : r.reconciled_as === 'landlord_payout'
            ? r.landlord_name
            : r.reconciled_as === 'property_expense' ? r.property_address : null,
        note: r.note,
        suggestion: suggestions[r.id] || null
      }))
    }
  });
});

// ── Reconcile / ignore / undo ───────────────────────────────────────────────

// POST /xero/transactions/:id/reconcile
//   { as: 'tenant_rent', tenancy_id }
//   { as: 'landlord_payout', landlord_id, statement_ids: [] }
//   { as: 'property_expense', property_id, note? }
export const reconcileBankTransaction = catchAsync(async (req, res) => {
  const { as } = req.body;
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) || null : null;

  await db.transaction(async (trx) => {
    const row = await trx('xero_bank_transactions').where('id', req.params.id).forUpdate().first();
    if (!row) throw new ApiError(404, 'Transaction not found');
    if (row.status !== 'unreconciled') throw new ApiError(400, 'This transaction is already reconciled or ignored');

    const base = { status: 'reconciled', reconciled_as: as, auto_matched: false, note, reconciled_by: req.user.id, reconciled_at: trx.fn.now() };

    if (as === 'tenant_rent') {
      if (row.direction !== 'in') throw new ApiError(400, 'Only money in can be recorded as rent');
      const tenancyId = Number(req.body.tenancy_id);
      const tenancy = await trx('tenancies').where('id', tenancyId).first();
      if (!tenancy) throw new ApiError(400, 'Select a tenant');
      const r = await recordRent(trx, row, tenancyId, req.user.id);
      await rememberContact(trx, row.contact_id, 'tenant', tenancyId, req.user.id);
      await trx('xero_bank_transactions').where('id', row.id).update({
        ...base, tenancy_id: tenancyId, property_id: r.property_id, landlord_id: r.landlord_id,
        rent_payment_id: r.rent_payment_id, ledger_transaction_id: r.ledger_transaction_id
      });
    } else if (as === 'landlord_payout') {
      if (row.direction !== 'out') throw new ApiError(400, 'Only money out can be a landlord payout');
      const landlordId = Number(req.body.landlord_id);
      const landlord = await trx('users').where({ id: landlordId, role: 'LANDLORD' }).first();
      if (!landlord) throw new ApiError(400, 'Select a landlord');
      const ids = Array.isArray(req.body.statement_ids) ? [...new Set(req.body.statement_ids.map(Number))] : [];
      if (ids.length) {
        const own = await trx('landlord_statements').whereIn('id', ids).where('landlord_id', landlordId).count('* as n').first();
        if (Number(own.n) !== ids.length) throw new ApiError(400, 'Selected statements must belong to this landlord');
      }
      const meta = ids.length ? await payStatements(trx, row, ids) : [];
      await rememberContact(trx, row.contact_id, 'landlord', landlordId, req.user.id);
      await trx('xero_bank_transactions').where('id', row.id).update({ ...base, landlord_id: landlordId, link_meta: JSON.stringify(meta) });
    } else if (as === 'property_expense') {
      if (row.direction !== 'out') throw new ApiError(400, 'Only money out can be a property expense');
      const property = await trx('properties').where('id', Number(req.body.property_id)).first();
      if (!property) throw new ApiError(400, 'Select a property');
      const [ledgerId] = await trx('transactions').insert({
        type: 'deduction',
        property_id: property.id,
        landlord_id: property.landlord_id,
        amount: parseFloat(row.amount).toFixed(2),
        transaction_date: localYmd(row.date),
        reconciled: 1,
        created_by: req.user.id,
        description: `Expense via Xero: ${note || row.reference || row.contact_name || ''}`.slice(0, 255)
      });
      await trx('xero_bank_transactions').where('id', row.id).update({
        ...base, property_id: property.id, landlord_id: property.landlord_id, ledger_transaction_id: ledgerId
      });
    } else {
      throw new ApiError(400, 'Choose tenant rent, landlord payout or property expense');
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'XERO_TRANSACTION_RECONCILED',
      entity_type: 'xero_bank_transaction',
      entity_id: row.id,
      meta: JSON.stringify({ as, amount: row.amount, date: localYmd(row.date), tenancy_id: req.body.tenancy_id || null, landlord_id: req.body.landlord_id || null, property_id: req.body.property_id || null }),
      ip_address: req.ip || null
    });
  });

  res.json({ success: true, message: 'Transaction reconciled' });
});

// POST /xero/transactions/:id/ignore
export const ignoreBankTransaction = catchAsync(async (req, res) => {
  const row = await db('xero_bank_transactions').where('id', req.params.id).first();
  if (!row) throw new ApiError(404, 'Transaction not found');
  if (row.status !== 'unreconciled') throw new ApiError(400, 'Only unreconciled transactions can be ignored');
  await db('xero_bank_transactions').where('id', row.id).update({
    status: 'ignored', note: typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) || null : null,
    reconciled_by: req.user.id, reconciled_at: db.fn.now()
  });
  res.json({ success: true, message: 'Transaction ignored' });
});

// POST /xero/transactions/:id/undo — back to "To reconcile", reversing what
// reconciling created. Blocked once a statement already includes the money.
export const undoBankTransaction = catchAsync(async (req, res) => {
  await db.transaction(async (trx) => {
    const row = await trx('xero_bank_transactions').where('id', req.params.id).forUpdate().first();
    if (!row) throw new ApiError(404, 'Transaction not found');
    if (row.status === 'unreconciled') throw new ApiError(400, 'Nothing to undo');
    const date = localYmd(row.date);

    if (row.status === 'reconciled' && row.reconciled_as === 'tenant_rent') {
      const payment = row.rent_payment_id ? await trx('rent_payments').where('id', row.rent_payment_id).first() : null;
      const claimed = payment
        ? await trx('rent_payment_allocations as a')
          .join('landlord_statements as s', 'a.statement_id', 's.id')
          .where('a.payment_id', payment.id)
          .select('s.statement_number')
          .first()
        : null;
      if (claimed) throw new ApiError(409, `Statement ${claimed.statement_number} already includes this rent — it can't be undone`);
      if (payment) {
        await trx('rent_payments').where('id', payment.id).delete(); // allocations cascade
        await allocateTenancyPayments(trx, payment.tenancy_id);
      }
      if (row.ledger_transaction_id) await trx('transactions').where('id', row.ledger_transaction_id).delete();
    } else if (row.status === 'reconciled' && row.reconciled_as === 'landlord_payout') {
      const meta = row.link_meta ? JSON.parse(row.link_meta) : [];
      for (const s of meta) {
        await trx('landlord_statements').where('id', s.id).update({ status: s.prev_status || 'sent', paid_at: null });
      }
    } else if (row.status === 'reconciled' && row.reconciled_as === 'property_expense') {
      const covered = await trx('landlord_statements')
        .where('source_property_id', String(row.property_id))
        .whereNotNull('tenancy_id')
        .where('period_start', '<=', date)
        .where('period_end', '>=', date)
        .first();
      if (covered) throw new ApiError(409, `Statement ${covered.statement_number} already covers this expense's date — it can't be undone`);
      if (row.ledger_transaction_id) await trx('transactions').where('id', row.ledger_transaction_id).delete();
    }

    await trx('xero_bank_transactions').where('id', row.id).update({
      status: 'unreconciled', reconciled_as: null, tenancy_id: null, landlord_id: null, property_id: null,
      rent_payment_id: null, ledger_transaction_id: null, link_meta: null, auto_matched: false,
      note: null, reconciled_by: null, reconciled_at: null
    });
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'XERO_TRANSACTION_UNDONE',
      entity_type: 'xero_bank_transaction',
      entity_id: row.id,
      meta: JSON.stringify({ was: row.status, as: row.reconciled_as }),
      ip_address: req.ip || null
    });
  });
  res.json({ success: true, message: 'Moved back to To reconcile' });
});
