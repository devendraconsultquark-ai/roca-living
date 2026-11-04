import db from '../config/db.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { toYmd, todayYmd } from '../utils/dateHelpers.js';
import { rentPeriodFor } from '../utils/rentSchedules.js';
import { getStoredConnection } from '../utils/xero.js';
import { estateDisplayFor } from '../utils/estatesLink.js';
import { pushRentInvoices, pullInvoicePayments } from '../utils/xeroRentInvoices.js';
import { sendRentSplit, settleRentMonth, pullLandlordBillStatus } from '../utils/xeroLandlordBills.js';
import { applyRepairDeductions } from '../utils/repairDeductions.js';
import { billOpen, latestOf } from '../utils/rentGroups.js';
import { historyRows } from '../utils/xeroHistory.js';

// Rent Cycle — the whole monthly rent flow on one page (Accounting → Rent Cycle).
// One row per managed flat's rent month, moving through:
//   waiting       invoice in Xero, no money yet — or only part of the rent
//                 (it waits for the rest; the admin can pay the landlord what
//                 has arrived)
//   to_approve    rent arrived (matched in Xero): check the split, approve
//   pay_landlord  approved and sent to Xero as a bill: pay the landlord
//   landlord_paid Xero shows the landlord paid: make the statement
//   statement     statement from approved rent made
//   attention     something needs a look (reason given)
// Built on the existing pieces (rent invoices, payments, approvals, landlord
// bills, approved-rent statements). The usual statements are not involved.

const STAGES = ['waiting', 'to_approve', 'pay_landlord', 'landlord_paid', 'statement', 'attention'];
const UNIT_CODE_RE = /^[A-Z0-9]{1,10}$/;
const hasUnitCodes = (b, a) => UNIT_CODE_RE.test(String(b ?? '').trim().toUpperCase()) && UNIT_CODE_RE.test(String(a ?? '').trim().toUpperCase());
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pad2 = (n) => String(n).padStart(2, '0');
// One fee transfer in Xero can cover several parts of a month.
const transferKey = (p) => p.fee_transfer_id || `payment-${p.id}`;

// Roca Living's own copy of a landlord name is sometimes ALL CAPS ("PAUL BELEMA").
// Show it like the live ROCA Estates names: "Paul Belema". Mixed-case names are
// left as they are; initials such as GKP / UK / LLP stay in capitals.
const niceWord = (w) => {
  if (w === 'ltd') return 'Ltd';
  if (w === 'and' || w === 'of') return w;
  if (!/[aeiouy]/.test(w) || ['uk', 'plc', 'llp'].includes(w)) return w.toUpperCase();
  return w.replace(/(^|')([a-z])/g, (_, p, c) => p + c.toUpperCase());
};
const niceName = (name) => {
  const s = String(name || '').trim();
  if (!s || s !== s.toUpperCase() || !/[A-Z]/.test(s)) return s || null;
  return s.toLowerCase().replace(/[a-z][a-z']*/g, niceWord);
};

const monthRange = (month) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date();
  const first = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { month: first.slice(0, 7), first, last: `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(last.getDate())}` };
};

// Stage of one rent month from its payments (the least advanced one decides).
const stageOf = (payments) => {
  if (!payments.length) return { stage: 'waiting' };
  if (payments.some((p) => p.approval_status === 'attention')) {
    return { stage: 'attention', reason: payments.find((p) => p.approval_status === 'attention').split_note || 'Needs a look' };
  }
  if (payments.some((p) => p.approval_status === 'pending')) return { stage: 'to_approve' };
  const failed = payments.find((p) => p.xero_bill_status === 'failed');
  if (failed) return { stage: 'attention', reason: `Xero did not take the landlord bill: ${failed.xero_bill_error || 'unknown error'}`, retry_send: true };
  if (payments.some((p) => !p.xero_bill_status || p.xero_bill_status === 'voided')) return { stage: 'to_approve', approved_not_sent: true };
  if (payments.some((p) => p.xero_bill_status === 'posted')) return { stage: 'pay_landlord' };
  if (payments.some((p) => !p.approved_statement_id)) return { stage: 'landlord_paid' };
  return { stage: 'statement' };
};

// A period of several months: ?from=YYYY-MM-DD&to=YYYY-MM-DD (at most 12 months).
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const periodRange = (q) => {
  if (!q.from && !q.to) return monthRange(q.month);
  if (!YMD_RE.test(String(q.from)) || !YMD_RE.test(String(q.to))) throw new ApiError(400, 'Choose a From and To date');
  if (q.from > q.to) throw new ApiError(400, 'From must be on or before To');
  const months = (Number(q.to.slice(0, 4)) - Number(q.from.slice(0, 4))) * 12 + Number(q.to.slice(5, 7)) - Number(q.from.slice(5, 7)) + 1;
  if (months > 12) throw new ApiError(400, 'Choose at most 12 months');
  return { month: q.from.slice(0, 7), first: q.from, last: q.to };
};

// GET /rent-cycle?month=YYYY-MM  or  ?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getRentCycle = catchAsync(async (req, res) => {
  const { month, first, last } = periodRange(req.query);
  const today = todayYmd();

  // Completed repairs onto open landlord bills first, so the figures below include them.
  const openFlats = await db('rent_payments as rp').join('tenancies as t', 'rp.tenancy_id', 't.id')
    .whereIn('rp.approval_status', ['pending', 'approved'])
    .where((q) => q.whereNull('rp.xero_bill_status').orWhereIn('rp.xero_bill_status', ['failed', 'voided']))
    .distinct('t.property_id').pluck('t.property_id');
  const repairsWaiting = new Map();
  for (const pid of openFlats) {
    const waiting = await db.transaction((trx) => applyRepairDeductions(trx, pid));
    if (waiting.length) repairsWaiting.set(pid, waiting);
  }

  const months = await db('rent_schedules as s')
    .join('tenancies as t', 's.tenancy_id', 't.id')
    .join('properties as p', 't.property_id', 'p.id')
    .leftJoin('users as l', 'p.landlord_id', 'l.id')
    .leftJoin('tenants as lead', function () {
      this.on('lead.tenancy_id', '=', 't.id').andOn('lead.is_lead_tenant', '=', db.raw('1'));
    })
    .where('p.managed_by_rl', true)
    .whereIn('t.status', ['active', 'notice'])
    .whereBetween('s.due_date', [first, last])
    .orderBy('p.block_name')
    .orderByRaw('CAST(p.apartment_number AS UNSIGNED)')
    .orderBy('s.due_date')
    .select(
      's.id as schedule_id', 's.tenancy_id', 't.property_id', 's.due_date', 's.amount as rent_due', 's.status as schedule_status', 's.paid_amount',
      't.start_date', 't.rent_due_day', 't.rent_due_day_from', 'p.block_name', 'p.apartment_number', 'p.address_line1', 'p.mgmt_fee_pct', 'p.rocaem_property_id',
      'l.name as landlord_name', 'p.landlord_id', 'lead.name as tenant_name', 'lead.id as tenant_id'
    );

  const rows = [];
  // Landlord names as on statements: live from ROCA Estates (normal case),
  // else Roca Living's copy. Looked up once per flat.
  const liveNames = new Map();
  const landlordNameFor = async (m) => {
    if (!liveNames.has(m.rocaem_property_id)) {
      const live = m.rocaem_property_id ? await estateDisplayFor(m.rocaem_property_id) : null;
      liveNames.set(m.rocaem_property_id, live?.landlord_name || null);
    }
    return liveNames.get(m.rocaem_property_id) || niceName(m.landlord_name);
  };
  for (const m of months) {
    const due = toYmd(m.due_date);
    const flat = hasUnitCodes(m.block_name, m.apartment_number) ? `${String(m.block_name).toUpperCase()}-${m.apartment_number}` : (m.address_line1 || '—');
    // A month can have more than one invoice (one replaced after the due day
    // changed, say): its payments are on any of them; the paid one is shown.
    const invoices = await db('xero_rent_invoices')
      .where({ tenancy_id: m.tenancy_id }).where('due_date', due)
      .whereIn('status', ['created', 'part', 'paid', 'attention'])
      .orderByRaw("FIELD(status, 'paid', 'part', 'attention', 'created')").orderBy('id', 'desc')
      .select('invoice_number', 'status', 'amount_paid', 'error');
    const invoice = invoices[0] || null;
    const payments = invoice
      ? await db('rent_payments').whereIn('xero_invoice_number', invoices.map((i) => i.invoice_number)).whereNotNull('xero_payment_id')
        .select('id', 'amount', 'received_at', 'fee_pct', 'fee_amount', 'net_amount', 'approval_status', 'approved_at', 'split_note',
          'xero_bill_number', 'xero_bill_status', 'xero_bill_error', 'landlord_paid_at', 'approved_statement_id', 'deductions_amount',
          'fee_transfer_status', 'fee_transfer_error', 'fee_transfer_id', 'tenancy_id', 'xero_invoice_number', 'settlement_lead_id')
      : [];
    // The rest of the split: bills to contractors for the repairs, ROCA's fee moved.
    const repairLines = payments.length
      ? await db('rent_payment_deductions as d').join('maintenance_tickets as mt', 'd.ticket_id', 'mt.id')
        .leftJoin('contractors as c', 'mt.contractor_id', 'c.id')
        .whereIn('d.rent_payment_id', payments.map((p) => p.id))
        .orderBy('d.id')
        .select('d.ticket_id', 'd.amount', 'd.xero_bill_number', 'd.xero_bill_status', 'd.xero_bill_error', 'd.paid_at', 'c.company_name as contractor')
      : [];
    const contractorBills = repairLines.map((l) => ({
      ticket_id: l.ticket_id, contractor: l.contractor || null, amount: round2(l.amount),
      number: l.xero_bill_number || null, status: l.contractor ? (l.xero_bill_status || null) : 'no_contractor',
      error: l.xero_bill_error || null, paid_at: l.paid_at ? toYmd(l.paid_at) : null,
    }));
    // ROCA's fee: recorded in Xero (still to move in the bank) or moved (matched in the bank).
    const feeStatuses = payments.map((p) => (p.fee_transfer_status === 'done' ? 'recorded' : p.fee_transfer_status)).filter(Boolean);
    const feeToMove = round2(payments.filter((p) => ['recorded', 'done'].includes(p.fee_transfer_status)).reduce((s, p) => s + Number(p.fee_amount || 0), 0));
    const feeTransfer = feeStatuses.includes('failed') ? { status: 'failed', error: payments.find((p) => p.fee_transfer_status === 'failed').fee_transfer_error }
      : feeStatuses.includes('skipped') ? { status: 'skipped', error: payments.find((p) => p.fee_transfer_status === 'skipped').fee_transfer_error }
        : feeStatuses.includes('recorded') ? { status: 'recorded', amount: feeToMove }
          : feeStatuses.length && feeStatuses.every((x) => x === 'moved') ? { status: 'moved' } : null;

    let st;
    if (!hasUnitCodes(m.block_name, m.apartment_number)) {
      st = { stage: 'attention', reason: 'Set the block code and flat number on this property — no Xero invoice until then' };
    } else if (invoice?.status === 'attention') {
      st = { stage: 'attention', reason: invoice.error || 'Rent changed after money was paid in Xero' };
    } else if (!invoice && m.schedule_status === 'paid') {
      // No Xero invoice for this month (e.g. before "Create invoices from"), yet
      // paid: by hand in Roca, or by a Xero payment Roca put on the oldest month.
      const fromXero = await db('rent_payment_allocations as a')
        .join('rent_payments as rp', 'rp.id', 'a.payment_id')
        .where('a.schedule_id', m.schedule_id).whereNotNull('rp.xero_payment_id').first('a.id');
      st = {
        stage: 'statement',
        outside: true,
        reason: fromXero
          ? "Paid from the tenant's Xero payment (money goes to the oldest rent month first)"
          : 'Paid and recorded in Roca by hand (not through Xero)'
      };
    } else {
      st = stageOf(payments);
      // Landlord bill in Xero but a contractor bill or the fee transfer failed: Try again redoes only those.
      const partFailed = contractorBills.find((b) => b.status === 'failed') || (feeTransfer?.status === 'failed' ? feeTransfer : null);
      if (partFailed && ['pay_landlord', 'landlord_paid', 'statement'].includes(st.stage)) {
        st = { stage: 'attention', reason: `${partFailed.ticket_id ? `Contractor bill (ticket #${partFailed.ticket_id})` : 'Fee transfer'} not in Xero: ${partFailed.error || 'unknown error'}`, retry_send: true };
      }
    }

    // Rent paid in parts: the month waits for the rest, then is approved once
    // (one landlord bill, one fee transfer). The admin can settle what has
    // arrived ("Pay Landlord What's Received"); the rest comes back on its own.
    const received = round2(payments.reduce((s, p) => s + Number(p.amount), 0));
    const owed = round2(Number(m.rent_due) - received);
    const partPaid = invoice?.status === 'part' && owed > 0 ? { received, due: round2(m.rent_due), owed, overdue: due < today } : null;
    if (partPaid && st.stage === 'to_approve' && !st.approved_not_sent) st = { stage: 'waiting', part_paid_waiting: true };
    // The payments still to settle; the popup works on the latest of them.
    const open = payments.filter(billOpen);

    const statementIds = [...new Set(payments.map((p) => p.approved_statement_id).filter(Boolean))];
    const statements = statementIds.length
      ? (await db('approved_rent_statements').whereIn('id', statementIds).select('id', 'statement_number', 'status', 'sent_at'))
        .map((x) => ({ ...x, sent_at: x.sent_at ? new Date(x.sent_at).toISOString() : null }))
      : [];
    const period = rentPeriodFor(due, toYmd(m.start_date), m.rent_due_day, m.rent_due_day_from ? toYmd(m.rent_due_day_from) : null);
    rows.push({
      key: `${m.tenancy_id}-${due}`,
      tenancy_id: m.tenancy_id,
      tenant_id: m.tenant_id,
      flat,
      tenant_name: m.tenant_name,
      landlord_name: await landlordNameFor(m),
      landlord_id: m.landlord_id,
      due_date: due,
      period,
      overdue: st.stage === 'waiting' && due < today,
      rent_due: round2(m.rent_due),
      invoice_number: invoice?.invoice_number || null,
      received,
      part_paid: partPaid,
      fee: round2(payments.reduce((s, p) => s + Number(p.fee_amount || 0), 0)),
      deductions: round2(payments.reduce((s, p) => s + Number(p.deductions_amount || 0), 0)),
      net: round2(payments.reduce((s, p) => s + Number(p.net_amount ?? p.amount), 0)),
      fee_pct: payments[0]?.fee_pct ? Number(payments[0].fee_pct) : Number(m.mgmt_fee_pct ?? 8),
      split_note: payments.find((p) => p.split_note)?.split_note || null,
      payment_ids: payments.map((p) => p.id),
      open_payment_ids: open.map((p) => p.id),
      lead_payment_id: open.length ? latestOf(open).id : null,
      // The landlord's share on bills in Xero not paid yet.
      landlord_to_pay: round2(payments.filter((p) => p.xero_bill_status === 'posted').reduce((s, p) => s + Number(p.net_amount ?? p.amount), 0)),
      // …and on bills already paid (a month settled in two goes can be half paid).
      landlord_paid_amount: round2(payments.filter((p) => p.xero_bill_status === 'paid').reduce((s, p) => s + Number(p.net_amount ?? p.amount), 0)),
      // ROCA's fee transfers recorded in Xero, not matched in the bank yet: one
      // line each, so the admin makes the same transfers and Xero matches them.
      fee_transfers_to_move: [...new Set(payments.filter((p) => ['recorded', 'done'].includes(p.fee_transfer_status)).map(transferKey))]
        .map((id) => {
          const parts = payments.filter((p) => transferKey(p) === id);
          const bill = parts.find((p) => p.xero_bill_number)?.xero_bill_number || '';
          return { id, amount: round2(parts.reduce((s, p) => s + Number(p.fee_amount || 0), 0)), reference: `MF ${flat} ${bill}`.trim() };
        }),
      bill_number: payments.find((p) => p.xero_bill_number && p.xero_bill_status !== 'voided')?.xero_bill_number || null,
      landlord_paid_at: payments.map((p) => p.landlord_paid_at && toYmd(p.landlord_paid_at)).filter(Boolean).sort().pop() || null,
      statements,
      // Completed repairs too big for this flat's open payments (they wait).
      repairs_waiting: repairsWaiting.get(m.property_id) || [],
      contractor_bills: contractorBills,
      fee_transfer: feeTransfer,
      ...st
    });
  }

  // Months from before Roca Living (put into Xero by the history import):
  // read-only rows, Done, never in To Do in the Bank or Approve All.
  const history = await historyRows(db('rent_history').where('status', 'done').whereBetween('month_label', [first.slice(0, 7), last.slice(0, 7)]));
  for (const h of history) {
    if (rows.some((r) => r.flat === h.flat && !r.history && String(r.due_date).slice(0, 7) === h.month_label)) continue;
    rows.push({
      key: `history-${h.id}`, history: true, tenancy_id: h.tenancy_id, tenant_id: null, flat: h.flat,
      tenant_name: h.tenant_name, landlord_name: h.landlord_name, landlord_id: null,
      due_date: h.parts[0]?.date || h.paid_on, period: null, overdue: false, rent_due: h.rent_total,
      invoice_number: h.xero_invoice_number, received: h.rent_total, part_paid: null, fee: h.fee, deductions: h.repairs,
      net: h.landlord_paid, fee_pct: h.rent_total ? round2((h.fee / h.rent_total) * 100) : 0, split_note: null,
      payment_ids: [], open_payment_ids: [], lead_payment_id: null, landlord_to_pay: 0, landlord_paid_amount: h.landlord_paid,
      fee_transfers_to_move: [], bill_number: h.xero_bill_number, landlord_paid_at: h.paid_on, statements: [],
      repairs_waiting: [], contractor_bills: [], fee_transfer: h.fee > 0 ? { status: 'moved' } : null,
      stage: 'statement', outside: true, reason: `Before Roca Living · ${h.xero_invoice_number} / ${h.xero_bill_number}`
    });
  }
  if (history.length) rows.sort((a, b) => a.flat.localeCompare(b.flat, 'en', { numeric: true }) || a.due_date.localeCompare(b.due_date));

  const counts = Object.fromEntries(STAGES.map((s) => [s, rows.filter((r) => r.stage === s).length]));
  // What to transfer to each landlord (bills waiting in Xero) and to each
  // contractor (repair bills not paid yet).
  const toPay = {};
  rows.filter((r) => r.landlord_to_pay > 0).forEach((r) => {
    const k = r.landlord_name || 'Landlord';
    toPay[k] = round2((toPay[k] || 0) + r.landlord_to_pay);
  });
  // ROCA's fees recorded in Xero, still to move in the bank (per flat).
  const feesToMove = rows.flatMap((r) => r.fee_transfers_to_move.map((f) => ({ flat: r.flat, ...f })));
  const toPayContractors = {};
  rows.forEach((r) => r.contractor_bills.filter((b) => b.status === 'posted').forEach((b) => {
    toPayContractors[b.contractor] = round2((toPayContractors[b.contractor] || 0) + b.amount);
  }));
  const lastRefresh = (await db('settings').where({ key: 'xeroRentCycleRefreshedAt' }).first())?.value || null;
  const connection = await getStoredConnection();
  res.json({
    success: true,
    data: {
      month, first, last, rows, counts,
      landlord_totals: Object.entries(toPay).map(([landlord, amount]) => ({ landlord, amount })),
      contractor_totals: Object.entries(toPayContractors).map(([contractor, amount]) => ({ contractor, amount })),
      fees_to_move: feesToMove,
      last_refresh: lastRefresh,
      xero_connected: Boolean(connection && connection.status === 'active')
    }
  });
});

// POST /rent-cycle/refresh — bring everything up to date with Xero: create the
// missing rent invoices, read rent paid, read landlord bills paid. At most once
// a minute (opening the page calls it).
let refreshing = null;
export const refreshRentCycle = catchAsync(async (req, res) => {
  const last = (await db('settings').where({ key: 'xeroRentCycleRefreshedAt' }).first())?.value;
  if (!req.body?.force && last && Date.now() - new Date(last).getTime() < 60_000) {
    return res.json({ success: true, message: 'Checked with Xero less than a minute ago', data: { skipped: true, last_refresh: last } });
  }
  if (!refreshing) {
    refreshing = (async () => {
      const result = { invoices: null, payments: null, bills: null };
      result.invoices = await pushRentInvoices(req.user.id);
      result.payments = await pullInvoicePayments(req.user.id);
      result.bills = await pullLandlordBillStatus();
      const at = new Date().toISOString();
      await db('settings').where({ key: 'xeroRentCycleRefreshedAt' }).delete();
      await db('settings').insert({ key: 'xeroRentCycleRefreshedAt', value: at });
      return { ...result, last_refresh: at };
    })().finally(() => { refreshing = null; });
  }
  const result = await refreshing;
  const newRent = (result.payments?.recorded || 0) + (result.payments?.linked || 0);
  res.json({
    success: true,
    message: `Up to date with Xero${newRent ? ` — ${newRent} new rent payment(s) to approve` : ''}${result.bills?.paid ? `, ${result.bills.paid} landlord(s) paid` : ''}`,
    data: result
  });
});

// POST /rent-cycle/approve { payment_ids: [] } — approve the split AND send it
// to Xero, in one step (each recorded with who and when). The payments of one
// rent month not on a landlord bill yet are settled together: one landlord
// bill, one fee transfer. "Pay Landlord What's Received" on a part-paid month
// is the same call with the parts that have arrived.
export const approveAndSend = catchAsync(async (req, res) => {
  const ids = Array.isArray(req.body?.payment_ids) ? req.body.payment_ids.map(Number).filter(Number.isInteger) : [];
  if (!ids.length) throw new ApiError(400, 'Nothing to approve');
  const payments = await db('rent_payments').whereIn('id', ids)
    .select('id', 'tenancy_id', 'approval_status', 'amount', 'fee_pct', 'fee_amount', 'deductions_amount', 'net_amount', 'xero_invoice_number',
      'xero_bill_status', 'settlement_lead_id');
  let approved = 0, sent = 0, failed = 0;
  const errors = [];
  for (const p of payments.filter((x) => x.approval_status === 'pending')) {
    await db.transaction(async (trx) => {
      await trx('rent_payments').where('id', p.id).update({ approval_status: 'approved', approved_by: req.user.id, approved_at: trx.fn.now() });
      await trx('audit_log').insert({
        actor_id: req.user.id, actor_role: req.user.role, action: 'RENT_SPLIT_APPROVED',
        entity_type: 'rent_payment', entity_id: p.id,
        meta: JSON.stringify({ amount: p.amount, fee_pct: p.fee_pct, fee_amount: p.fee_amount, deductions: p.deductions_amount, net_amount: p.net_amount, invoice: p.xero_invoice_number, via: 'rent_cycle' }),
        ip_address: req.ip || null
      });
    });
    p.approval_status = 'approved';
    approved++;
  }
  const record = (out, label) => {
    if (!out) return;
    if (out.landlord?.status === 'posted' || out.landlord?.already) sent++;
    if (out.errors.length) { failed++; errors.push(...out.errors); }
    if (out.errors.length) logger.warn(`[RentCycle] ${label}: ${out.errors.join('; ')}`);
  };
  // Not on a landlord bill yet: settle each tenancy's parts together.
  const approvedRows = payments.filter((p) => p.approval_status === 'approved');
  const byTenancy = new Map();
  for (const p of approvedRows.filter(billOpen)) byTenancy.set(p.tenancy_id, [...(byTenancy.get(p.tenancy_id) || []), p.id]);
  for (const [tenancyId, list] of byTenancy) {
    try {
      record(await settleRentMonth(list, req.user.id), `tenancy ${tenancyId}`);
    } catch (err) {
      failed++; errors.push(err.message);
      logger.warn(`[RentCycle] settling tenancy ${tenancyId}: ${err.message}`);
    }
  }
  // Already on a landlord bill: Try again redoes a contractor bill or fee transfer that failed.
  const leads = new Set(approvedRows.filter((p) => !billOpen(p)).map((p) => p.settlement_lead_id || p.id));
  for (const lead of leads) {
    try {
      record(await sendRentSplit(lead, req.user.id), `payment ${lead}`);
    } catch (err) {
      failed++; errors.push(err.message);
      logger.warn(`[RentCycle] split for payment ${lead}: ${err.message}`);
    }
  }
  res.json({
    success: true,
    message: `Approved ${approved}, sent ${sent} landlord bill(s) to Xero${failed ? ` — not everything went through: ${errors[0]}` : ''}`,
    data: { approved, sent, failed }
  });
});
