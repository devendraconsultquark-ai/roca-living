import db from '../config/db.js';
import logger from './logger.js';
import { ApiError } from './ApiError.js';
import { getSetting } from './settings.js';
import { toYmd, todayYmd, addDays } from './dateHelpers.js';
import { rentPeriodFor } from './rentSchedules.js';
import { getStoredConnection, xeroApiRaw } from './xero.js';
import { allocateTenancyPayments } from './rentAllocation.js';
import { findSimilarPayment } from './rentPayments.js';
import { applyRepairDeductions } from './repairDeductions.js';

// Internal rent invoices in Xero (rent cycle phase 2). One Xero invoice per rent
// month of a managed flat, raised to a contact per tenancy and never sent to the
// tenant: it gives Xero's bank feed / auto-reconcile something to match the
// tenant's payment to. Roca Living then reads the payment (phase 3).
//
// Safe to run any number of times: a month that already has a live invoice is
// skipped, the invoice number is looked up in Xero before creating (so a crash
// between Xero and our database never doubles one), and an unpaid invoice whose
// rent month changed or disappeared is voided before its replacement is made.

export const SETTING_INVOICES_FROM = 'xeroInvoicesFrom';
const LEAD_DAYS = 14; // invoices exist this many days before the rent falls due
const TITLES = new Set(['MR', 'MRS', 'MISS', 'MS', 'MX', 'DR']);
const pad2 = (n) => String(n).padStart(2, '0');
const uk = (ymd) => ymd.split('-').reverse().join('/');

// Xero allows 60 calls a minute per organisation; stay just under it.
const callTimes = [];
const throttle = async () => {
  const now = Date.now();
  while (callTimes.length && now - callTimes[0] > 60_000) callTimes.shift();
  if (callTimes.length >= 55) await new Promise((r) => setTimeout(r, 60_000 - (now - callTimes[0]) + 250));
  callTimes.push(Date.now());
};
const xero = async (method, path, opts) => { await throttle(); return xeroApiRaw(method, path, opts); };

// First day of the current month: invoices start from here unless the admin
// chose another date, so old, already-settled history is not recreated.
export const getInvoicesFrom = async () => {
  const v = await getSetting(SETTING_INVOICES_FROM, null);
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
};

// A flat needs a short block code and flat number (PH, 8) — the same rule as
// statements — or its invoices would carry a broken number and contact.
const UNIT_CODE_RE = /^[A-Z0-9]{1,10}$/;
const hasUnitCodes = (block, apt) =>
  UNIT_CODE_RE.test(String(block ?? '').trim().toUpperCase()) && UNIT_CODE_RE.test(String(apt ?? '').trim().toUpperCase());

const unitCode = (block, apt) => `${String(block || '').trim().toUpperCase()}${String(apt || '').trim()}`;
const firstName = (name) => String(name || '').trim().split(/\s+/).find((w) => !TITLES.has(w.replace(/\./g, '').toUpperCase())) || '';

// Xero's error text, shortened to what an admin can act on.
const xeroMessage = (error) => {
  try {
    const body = JSON.parse(error);
    const v = body?.Elements?.[0]?.ValidationErrors?.map((e) => e.Message).filter(Boolean);
    return (v?.length ? v.join('; ') : body?.Message || body?.Detail || error).slice(0, 480);
  } catch {
    return String(error || 'Xero refused the request').slice(0, 480);
  }
};

// Rent months due in the window, of managed flats with a live tenancy, not yet
// fully paid in Roca Living.
const monthsToInvoice = (fromYmd, untilYmd) => db('rent_schedules as s')
  .join('tenancies as t', 's.tenancy_id', 't.id')
  .join('properties as p', 't.property_id', 'p.id')
  .leftJoin('tenants as lead', function () {
    this.on('lead.tenancy_id', '=', 't.id').andOn('lead.is_lead_tenant', '=', db.raw('1'));
  })
  .where('p.managed_by_rl', true)
  .whereIn('t.status', ['active', 'notice'])
  .whereBetween('s.due_date', [fromYmd, untilYmd])
  .whereNot('s.status', 'paid')
  .orderBy(['s.tenancy_id', 's.due_date'])
  .select(
    's.id as schedule_id', 's.tenancy_id', 's.due_date', 's.amount',
    't.start_date', 't.rent_due_day', 't.rent_due_day_from',
    'p.block_name', 'p.apartment_number', 'p.address_line1', 'p.city',
    'lead.name as tenant_name'
  );

// The contact a tenancy's invoices go to: the one used before, else a new one
// by name ("Kian Wagstaff (PH-8)") that Xero creates on the first invoice.
const contactByName = (row) => {
  const name = String(row.tenant_name || 'Tenant').trim();
  return { Name: `${name} (${String(row.block_name || '').toUpperCase()}-${row.apartment_number})`.slice(0, 255) };
};
const contactFor = async (row) => {
  const prev = await db('xero_rent_invoices')
    .where('tenancy_id', row.tenancy_id).whereNotNull('xero_contact_id')
    .orderBy('id', 'desc').first('xero_contact_id');
  return prev ? { ContactID: prev.xero_contact_id } : contactByName(row);
};

// Xero's answer for a ContactID it doesn't have (another or reconnected
// organisation, or a contact deleted/merged in Xero).
export const contactNotFound = (message) => /contact could not be found/i.test(String(message || ''));

// Remember the contact for matching the tenant's payments too (Bank Transactions).
const linkContact = async (contactId, tenancyId, actorId) => {
  if (!contactId) return;
  const existing = await db('xero_contact_links').where({ xero_contact_id: contactId, kind: 'tenant' }).first();
  if (!existing) await db('xero_contact_links').insert({ xero_contact_id: contactId, kind: 'tenant', tenancy_id: tenancyId, created_by: actorId || null });
};

// Xero keeps every invoice number for good — a voided invoice's number can't be
// used again. Take the first number for this month that is free both here and
// in Xero (RENT-PH08-20261002, then -2, -3 …). A live invoice already in Xero
// with that number and amount but missing here is ours, created just before a
// crash: it is reused instead of making a second one.
// Is this Xero document for the contact we would send? (ContactID, else name)
const sameContact = (found, contact) => (contact.ContactID
  ? found.Contact?.ContactID === contact.ContactID
  : String(found.Contact?.Name || '').trim().toLowerCase() === String(contact.Name || '').trim().toLowerCase());

const chooseInvoiceNumber = async (base, amount, contact) => {
  for (let v = 1; v <= 20; v++) {
    const number = v === 1 ? base : `${base}-${v}`;
    if (await db('xero_rent_invoices').where('invoice_number', number).first('id')) continue;
    const r = await xero('GET', '/Invoices', { searchParams: { InvoiceNumbers: number } });
    if (!r.ok) throw new Error(`Xero invoice lookup failed: ${xeroMessage(r.error)}`);
    const found = (r.body?.Invoices || []).find((i) => i.InvoiceNumber === number);
    if (!found) return { number, existing: null };
    // Only an approved, still unpaid invoice can be ours from an interrupted run;
    // anything else with this number (paid, voided) means: take the next number.
    if (found.Type === 'ACCREC' && found.Status === 'AUTHORISED' && Number(found.AmountPaid || 0) === 0 && Number(found.Total) === Number(amount) && sameContact(found, contact)) {
      return { number, existing: found };
    }
  }
  throw new Error(`No free invoice number for ${base}`);
};

const createInvoice = async (row, accountCode, actorId) => {
  const dueYmd = toYmd(row.due_date);
  const startYmd = toYmd(row.start_date);
  const code = unitCode(row.block_name, row.apartment_number);
  const base = `RENT-${String(row.block_name || '').toUpperCase()}${pad2(row.apartment_number)}-${dueYmd.replace(/-/g, '')}`;
  const period = rentPeriodFor(dueYmd, startYmd, row.rent_due_day, row.rent_due_day_from ? toYmd(row.rent_due_day_from) : null);
  const where = [`Apartment ${row.apartment_number}`, row.city].filter(Boolean).join(', ');
  const amount = parseFloat(row.amount).toFixed(2);
  let contact = await contactFor(row);

  let invoiceNumber;
  let invoice = null;
  for (let attempt = 1; !invoice; attempt++) {
    const chosen = await chooseInvoiceNumber(base, amount, contact);
    invoiceNumber = chosen.number;
    if (chosen.existing) { invoice = chosen.existing; break; }
    const r = await xero('PUT', '/Invoices', {
      searchParams: { summarizeErrors: 'false' },
      body: {
        Invoices: [{
          Type: 'ACCREC',
          Contact: contact,
          Date: dueYmd,
          DueDate: dueYmd,
          InvoiceNumber: invoiceNumber,
          Reference: `${code} ${firstName(row.tenant_name).toUpperCase()}`.trim(),
          Status: 'AUTHORISED',
          LineAmountTypes: 'NoTax',
          LineItems: [{
            Description: `Rent ${uk(period.start)} – ${uk(period.end)}, ${where}`,
            Quantity: 1,
            UnitAmount: Number(amount),
            AccountCode: accountCode
          }]
        }]
      }
    });
    const created = r.body?.Invoices?.[0];
    const errors = created?.ValidationErrors?.map((e) => e.Message).filter(Boolean) || [];
    if (!r.ok || !created?.InvoiceID || errors.length) {
      const error = errors.length ? errors.join('; ').slice(0, 480) : xeroMessage(r.error);
      // The tenant's earlier contact isn't in this Xero organisation: send by name once.
      if (attempt === 1 && contact.ContactID && contactNotFound(error)) {
        logger.warn(`[XeroRentInvoices] ${invoiceNumber}: contact ${contact.ContactID} not in Xero, retrying by name`);
        contact = contactByName(row);
        continue;
      }
      await db('xero_rent_invoices').insert({
        tenancy_id: row.tenancy_id, due_date: dueYmd, amount, invoice_number: invoiceNumber,
        status: 'failed', error
      });
      logger.warn(`[XeroRentInvoices] ${invoiceNumber} failed: ${error}`);
      return 'failed';
    }
    invoice = created;
  }

  await db('xero_rent_invoices').insert({
    tenancy_id: row.tenancy_id, due_date: dueYmd, amount, invoice_number: invoiceNumber,
    xero_invoice_id: invoice.InvoiceID, xero_contact_id: invoice.Contact?.ContactID || contact.ContactID || null,
    status: 'created'
  });
  await linkContact(invoice.Contact?.ContactID, row.tenancy_id, actorId);
  return 'created';
};

// Live, unpaid invoices whose rent month no longer exists (due day / start date
// changed) or whose amount changed (rent review) are voided in Xero; the
// correct month is invoiced again by the push. So is an unpaid duplicate for a
// month that already has a paid / part-paid invoice. Money already paid against
// an invoice is never undone — that row is flagged for the admin instead.
export const voidChangedInvoices = async () => {
  const live = await db('xero_rent_invoices as x')
    .leftJoin('rent_schedules as s', function () {
      this.on('s.tenancy_id', '=', 'x.tenancy_id').andOn('s.due_date', '=', 'x.due_date');
    })
    .join('tenancies as t', 't.id', 'x.tenancy_id')
    .join('properties as p', 'p.id', 't.property_id')
    .where('x.status', 'created')
    .select('x.id', 'x.tenancy_id', 'x.due_date', 'x.xero_invoice_id', 'x.invoice_number', 'x.amount', 's.id as schedule_id',
      's.amount as schedule_amount', 'p.block_name', 'p.apartment_number');
  const settled = new Set((await db('xero_rent_invoices').whereIn('status', ['paid', 'part']).select('tenancy_id', 'due_date'))
    .map((r) => `${r.tenancy_id}|${toYmd(r.due_date)}`));
  // Month gone, amount changed, the flat has no block code / flat number (it
  // should never have been invoiced — statements refuse such flats too), or the
  // month is already paid through another invoice.
  const changed = live.filter((x) => !x.schedule_id
    || Number(x.schedule_amount) !== Number(x.amount)
    || !hasUnitCodes(x.block_name, x.apartment_number)
    || settled.has(`${x.tenancy_id}|${toYmd(x.due_date)}`));

  let voided = 0, attention = 0;
  for (const inv of changed) {
    const r = await xero('GET', `/Invoices/${inv.xero_invoice_id}`);
    const current = r.body?.Invoices?.[0];
    if (!r.ok || !current) continue; // try again next time
    if (['VOIDED', 'DELETED'].includes(current.Status)) {
      await db('xero_rent_invoices').where('id', inv.id).update({ status: 'voided', updated_at: db.fn.now() });
      voided++;
      continue;
    }
    if (Number(current.AmountPaid || 0) > 0 || Number(current.AmountCredited || 0) > 0) {
      await db('xero_rent_invoices').where('id', inv.id).update({
        status: 'attention', error: 'The rent month changed after money was paid against this invoice in Xero', updated_at: db.fn.now()
      });
      attention++;
      continue;
    }
    const v = await xero('POST', `/Invoices/${inv.xero_invoice_id}`, { body: { Invoices: [{ InvoiceID: inv.xero_invoice_id, Status: 'VOIDED' }] } });
    if (v.ok) {
      await db('xero_rent_invoices').where('id', inv.id).update({ status: 'voided', updated_at: db.fn.now() });
      voided++;
    } else {
      logger.warn(`[XeroRentInvoices] Could not void ${inv.invoice_number}: ${xeroMessage(v.error)}`);
    }
  }
  return { voided, attention };
};

// Create the missing invoices (and void changed ones). Returns counts.
export const pushRentInvoices = async (actorId = null) => {
  const connection = await getStoredConnection();
  if (!connection || connection.status !== 'active') throw new ApiError(409, 'Xero is not connected');
  const accountCode = await getSetting('xeroRentIncomeAccountCode', null);
  if (!accountCode) throw new ApiError(400, 'Choose the "Rent invoices account" in Settings → Xero first');

  const { voided, attention } = await voidChangedInvoices();

  const fromYmd = await getInvoicesFrom();
  const untilYmd = addDays(todayYmd(), LEAD_DAYS);
  const all = await monthsToInvoice(fromYmd, untilYmd);
  // Flats without a block code / flat number are left out and named, so the
  // admin can fix them on the property (as for statements).
  const noCodes = [...new Set(all.filter((r) => !hasUnitCodes(r.block_name, r.apartment_number))
    .map((r) => String(r.address_line1 || `Tenancy ${r.tenancy_id}`).trim()))];
  const months = all.filter((r) => hasUnitCodes(r.block_name, r.apartment_number));
  let created = 0, failed = 0, skipped = 0;
  for (const row of months) {
    // Already invoiced (paid or not). Roca puts money on the oldest month first,
    // so a month whose Xero invoice is paid can still look unpaid in Roca.
    const live = await db('xero_rent_invoices')
      .where({ tenancy_id: row.tenancy_id }).where('due_date', toYmd(row.due_date))
      .whereIn('status', ['created', 'attention', 'part', 'paid']).first('id');
    if (live) { skipped++; continue; }
    // A failed earlier attempt is retried under the same number.
    await db('xero_rent_invoices')
      .where({ tenancy_id: row.tenancy_id, status: 'failed' }).where('due_date', toYmd(row.due_date)).delete();
    try {
      const result = await createInvoice(row, accountCode, actorId);
      if (result === 'created') created++; else failed++;
    } catch (err) {
      failed++;
      logger.error(`[XeroRentInvoices] tenancy ${row.tenancy_id} ${toYmd(row.due_date)}: ${err.message}`);
    }
  }
  return { from: fromYmd, until: untilYmd, created, voided, failed, attention, already: skipped, skipped_no_codes: noCodes };
};

// ── Payments against the rent invoices (rent cycle phase 3) ──────────────────
// When the admin (or Xero's auto-reconcile) matches a tenant's bank payment to
// one of our invoices, Xero records a Payment on it. Roca Living picks it up
// here, books it as rent (rent months, arrears), works out the split — the
// flat's management fee for ROCA, the rest for the landlord — and leaves it
// for the admin to approve. Nothing is written to Xero.

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Xero JSON dates: "/Date(1727827200000+0000)/" or ISO.
const xeroDateYmd = (v) => {
  const m = /\/Date\((-?\d+)/.exec(String(v || ''));
  if (m) return toYmd(new Date(Number(m[1])));
  return /^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : todayYmd();
};

export const splitFor = (amount, feePct) => {
  const pct = Number.isFinite(Number(feePct)) ? Number(feePct) : 8;
  const fee = round2((Number(amount) * pct) / 100);
  return { fee_pct: pct.toFixed(2), fee_amount: fee.toFixed(2), net_amount: round2(Number(amount) - fee).toFixed(2) };
};

const recordInvoicePayment = async (invoiceRow, payment, actorId) => db.transaction(async (trx) => {
  const tenancy = await trx('tenancies').where('id', invoiceRow.tenancy_id).first();
  if (!tenancy) return 'skipped';
  const property = await trx('properties').where('id', tenancy.property_id).first();
  const amount = round2(payment.Amount);
  const date = xeroDateYmd(payment.Date);
  const split = splitFor(amount, property?.mgmt_fee_pct ?? 8);
  const xeroFields = {
    xero_payment_id: payment.PaymentID,
    xero_invoice_number: invoiceRow.invoice_number,
    ...split,
    approval_status: 'pending'
  };

  // Typed in already with "Record Rent Payment"? Tie to it, don't book it twice.
  const typed = await findSimilarPayment(trx, tenancy.id, amount, date, { unlinkedOnly: true });
  if (typed && !typed.xero_payment_id) {
    await trx('rent_payments').where('id', typed.id).update({ ...xeroFields, xero_linked_existing: true });
    await trx('audit_log').insert({
      actor_id: actorId, actor_role: actorId ? 'ADMIN' : 'SYSTEM', action: 'XERO_RENT_PAYMENT_LINKED',
      entity_type: 'rent_payment', entity_id: typed.id,
      meta: JSON.stringify({ invoice: invoiceRow.invoice_number, payment: payment.PaymentID, amount }), ip_address: null
    });
    // Completed repairs waiting for a payment come off this one.
    await applyRepairDeductions(trx, tenancy.property_id);
    return 'linked';
  }

  const reference = `Xero ${invoiceRow.invoice_number}`;
  const [paymentId] = await trx('rent_payments').insert({
    tenancy_id: tenancy.id,
    schedule_id: null,
    received_at: date,
    amount: amount.toFixed(2),
    method: 'bank_transfer',
    reference,
    reconciled: 1,
    reconciled_by: actorId,
    notes: 'Paid against the rent invoice in Xero',
    ...xeroFields
  });
  // Applied to rent months oldest first; part payments stay owed, surplus is credit.
  await allocateTenancyPayments(trx, tenancy.id);
  await trx('transactions').insert({
    type: 'rent_in',
    property_id: tenancy.property_id,
    landlord_id: property?.landlord_id || null,
    tenancy_id: tenancy.id,
    amount: amount.toFixed(2),
    transaction_date: date,
    reconciled: 1,
    created_by: actorId,
    description: `Rent received via Xero invoice ${invoiceRow.invoice_number} (payment ${payment.PaymentID})`
  });
  await trx('audit_log').insert({
    actor_id: actorId, actor_role: actorId ? 'ADMIN' : 'SYSTEM', action: 'XERO_RENT_PAYMENT_RECORDED',
    entity_type: 'rent_payment', entity_id: paymentId,
    meta: JSON.stringify({ invoice: invoiceRow.invoice_number, payment: payment.PaymentID, amount, ...split }), ip_address: null
  });
  // Completed repairs waiting for a payment come off this one.
  await applyRepairDeductions(trx, tenancy.property_id);
  return 'recorded';
});

// The payment no longer exists in Xero (the match was undone there): undo it
// here too — unless a statement already includes it, then flag it instead.
const removeInvoicePayment = async (rentPayment) => db.transaction(async (trx) => {
  if (rentPayment.xero_linked_existing) {
    // A typed-in payment stays; it just isn't tied to Xero any more.
    await trx('rent_payments').where('id', rentPayment.id).update({
      xero_payment_id: null, xero_invoice_number: null, xero_linked_existing: false,
      fee_pct: null, fee_amount: null, net_amount: null, approval_status: null, approved_by: null, approved_at: null, split_note: null
    });
    return 'removed';
  }
  const claimed = await trx('rent_payment_allocations').where('payment_id', rentPayment.id).whereNotNull('statement_id').first();
  if (claimed) {
    await trx('rent_payments').where('id', rentPayment.id).update({
      approval_status: 'attention', split_note: 'This payment was removed in Xero after a statement included it'
    });
    return 'flagged';
  }
  await trx('transactions').where('tenancy_id', rentPayment.tenancy_id).where('description', 'like', `%(payment ${rentPayment.xero_payment_id})%`).delete();
  await trx('rent_payment_allocations').where('payment_id', rentPayment.id).delete();
  await trx('rent_payments').where('id', rentPayment.id).delete();
  await allocateTenancyPayments(trx, rentPayment.tenancy_id);
  return 'removed';
});

export const pullInvoicePayments = async (actorId = null) => {
  const connection = await getStoredConnection();
  if (!connection || connection.status !== 'active') throw new ApiError(409, 'Xero is not connected');

  const rows = await db('xero_rent_invoices')
    .whereIn('status', ['created', 'part', 'paid', 'attention'])
    .whereNotNull('xero_invoice_id')
    .select('id', 'tenancy_id', 'invoice_number', 'xero_invoice_id', 'status', 'amount_paid');
  const counts = { recorded: 0, linked: 0, removed: 0, flagged: 0 };

  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    const byId = new Map(chunk.map((r) => [r.xero_invoice_id, r]));
    const r = await xero('GET', '/Invoices', { searchParams: { IDs: chunk.map((c) => c.xero_invoice_id).join(',') } });
    if (!r.ok) {
      logger.warn(`[XeroRentPayments] Could not read invoices: ${xeroMessage(r.error)}`);
      continue;
    }
    for (const inv of r.body?.Invoices || []) {
      const row = byId.get(inv.InvoiceID);
      if (!row) continue;
      const payments = (inv.Payments || []).filter((p) => p.PaymentID && p.Status !== 'DELETED');
      const live = new Set(payments.map((p) => p.PaymentID));

      for (const p of payments) {
        if (await db('rent_payments').where('xero_payment_id', p.PaymentID).first('id')) continue;
        try {
          const result = await recordInvoicePayment(row, p, actorId);
          if (result === 'recorded') counts.recorded++;
          if (result === 'linked') counts.linked++;
        } catch (err) {
          logger.error(`[XeroRentPayments] ${row.invoice_number} payment ${p.PaymentID}: ${err.message}`);
        }
      }

      const gone = await db('rent_payments')
        .where('xero_invoice_number', row.invoice_number).whereNotNull('xero_payment_id')
        .whereNotIn('xero_payment_id', live.size ? [...live] : ['-']);
      for (const rp of gone) {
        const result = await removeInvoicePayment(rp);
        if (result === 'removed') counts.removed++; else counts.flagged++;
      }

      const amountPaid = round2(inv.AmountPaid || 0);
      const status = inv.Status === 'VOIDED' || inv.Status === 'DELETED' ? 'voided'
        : inv.Status === 'PAID' ? 'paid'
          : amountPaid > 0 ? 'part'
            : row.status === 'attention' ? 'attention' : 'created';
      if (status !== row.status || amountPaid !== Number(row.amount_paid)) {
        await db('xero_rent_invoices').where('id', row.id).update({ status, amount_paid: amountPaid.toFixed(2), updated_at: db.fn.now() });
      }
    }
  }
  return counts;
};

// Shared with the landlord bills (rent cycle phase 4).
export { xero as xeroThrottled, xeroMessage, xeroDateYmd, round2 };
