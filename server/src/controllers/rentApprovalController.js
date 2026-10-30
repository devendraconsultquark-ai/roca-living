import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { toYmd } from '../utils/dateHelpers.js';
import { pullInvoicePayments, splitFor, round2 } from '../utils/xeroRentInvoices.js';
import { postLandlordBill, voidLandlordBill, pullLandlordBillStatus } from '../utils/xeroLandlordBills.js';
import { applyRepairDeductions } from '../utils/repairDeductions.js';

// Rent to approve (rent cycle phase 3): rent paid against Roca Living's rent
// invoices in Xero, with its split — the flat's management fee for ROCA and the
// rest for the landlord — waiting for the admin's approval. Approving records
// who and when; nothing is written to Xero yet. Statements are not affected.

const STATUSES = ['pending', 'approved', 'attention'];

// GET /xero/rent-approvals?status=pending|approved|attention
export const listRentApprovals = catchAsync(async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : 'pending';
  const rows = await db('rent_payments as p')
    .join('tenancies as t', 'p.tenancy_id', 't.id')
    .join('properties as pr', 't.property_id', 'pr.id')
    .leftJoin('users as l', 'pr.landlord_id', 'l.id')
    .leftJoin('tenants as lead', function () {
      this.on('lead.tenancy_id', '=', 't.id').andOn('lead.is_lead_tenant', '=', db.raw('1'));
    })
    .leftJoin('xero_rent_invoices as x', 'x.invoice_number', 'p.xero_invoice_number')
    .leftJoin('users as a', 'p.approved_by', 'a.id')
    .where('p.approval_status', status)
    .orderBy('p.received_at', status === 'pending' ? 'asc' : 'desc')
    .limit(200)
    .select(
      'p.id', 'p.tenancy_id', 'p.received_at', 'p.amount', 'p.fee_pct', 'p.fee_amount', 'p.net_amount',
      'p.xero_invoice_number', 'p.approval_status', 'p.approved_at', 'p.split_note', 'p.xero_linked_existing',
      'p.xero_bill_number', 'p.xero_bill_status', 'p.xero_bill_error', 'p.landlord_paid_at', 'p.approved_statement_id',
      'pr.block_name', 'pr.apartment_number', 'pr.mgmt_fee_pct',
      'l.name as landlord_name', 'lead.name as tenant_name', 'lead.id as tenant_id',
      'x.amount as rent_due', 'x.due_date as rent_due_date', 'a.name as approved_by_name'
    );
  const counts = await db('rent_payments').whereIn('approval_status', STATUSES).select('approval_status').count('* as n').groupBy('approval_status');
  res.json({
    success: true,
    data: {
      items: rows.map((r) => ({
        ...r,
        received_at: toYmd(r.received_at),
        rent_due_date: r.rent_due_date ? toYmd(r.rent_due_date) : null,
        approved_at: r.approved_at ? new Date(r.approved_at).toISOString() : null,
        landlord_paid_at: r.landlord_paid_at ? toYmd(r.landlord_paid_at) : null,
        flat: `${String(r.block_name || '').toUpperCase()}-${r.apartment_number}`
      })),
      counts: Object.fromEntries(counts.map((c) => [c.approval_status, Number(c.n)]))
    }
  });
});

const loadPending = async (id) => {
  const p = await db('rent_payments').where('id', id).first();
  if (!p || !p.approval_status) throw new ApiError(404, 'Rent payment to approve not found');
  if (p.approval_status !== 'pending') throw new ApiError(409, 'This rent payment has already been approved');
  return p;
};

// POST /xero/rent-approvals/:id/approve
export const approveRentPayment = catchAsync(async (req, res) => {
  const p = await loadPending(req.params.id);
  await db.transaction(async (trx) => {
    await trx('rent_payments').where('id', p.id).update({ approval_status: 'approved', approved_by: req.user.id, approved_at: trx.fn.now() });
    await trx('audit_log').insert({
      actor_id: req.user.id, actor_role: req.user.role, action: 'RENT_SPLIT_APPROVED',
      entity_type: 'rent_payment', entity_id: p.id,
      meta: JSON.stringify({ amount: p.amount, fee_pct: p.fee_pct, fee_amount: p.fee_amount, net_amount: p.net_amount, invoice: p.xero_invoice_number }),
      ip_address: req.ip || null
    });
  });
  res.json({ success: true, message: `Approved: £${p.fee_amount} to ROCA, £${p.net_amount} to the landlord` });
});

// PATCH /xero/rent-approvals/:id/split { fee_pct, reason } — for this payment only.
export const changeRentSplit = catchAsync(async (req, res) => {
  const p = await loadPending(req.params.id);
  const pct = Number(req.body?.fee_pct);
  const reason = String(req.body?.reason || '').trim();
  if (!Number.isFinite(pct) || pct < 0 || pct > 30) throw new ApiError(400, 'Management fee must be between 0 and 30%');
  if (!reason) throw new ApiError(400, 'Give a reason for changing the fee on this payment');
  const split = splitFor(p.amount, pct);
  // Deductions already set stay: the landlord gets rent − fee − deductions.
  const deductions = Number(p.deductions_amount || 0);
  const net = round2(Number(split.net_amount) - deductions);
  if (net < 0) throw new ApiError(400, `With £${deductions.toFixed(2)} of deductions, this fee would leave the landlord less than £0`);
  split.net_amount = net.toFixed(2);
  await db.transaction(async (trx) => {
    await trx('rent_payments').where('id', p.id).update({ ...split, split_note: reason.slice(0, 500) });
    await trx('audit_log').insert({
      actor_id: req.user.id, actor_role: req.user.role, action: 'RENT_SPLIT_CHANGED',
      entity_type: 'rent_payment', entity_id: p.id,
      meta: JSON.stringify({ from: { fee_pct: p.fee_pct, fee_amount: p.fee_amount }, to: split, reason }),
      ip_address: req.ip || null
    });
  });
  res.json({ success: true, message: `Fee set to ${split.fee_pct}% for this payment`, data: split });
});

// ── Deductions (cleaning, repairs…) before the landlord is paid ─────────────
// Costs ROCA paid for the flat, taken out of the landlord's share. They become
// minus lines on the Xero landlord bill and lines on the statement from
// approved rent. They can change until the bill is in Xero.

const deductionsEditable = (p) => p.approval_status === 'pending'
  || (p.approval_status === 'approved' && (!p.xero_bill_status || ['failed', 'voided'].includes(p.xero_bill_status)));

const loadForDeductions = async (id) => {
  const p = await db('rent_payments').where('id', id).first();
  if (!p || !p.approval_status) throw new ApiError(404, 'Rent payment not found');
  return p;
};

// The most that can be deducted: the landlord's share before deductions.
const landlordShare = (p) => round2(Number(p.amount) - Number(p.fee_amount || 0));

// GET /xero/rent-approvals/:id/deductions
export const getRentDeductions = catchAsync(async (req, res) => {
  const p = await loadForDeductions(req.params.id);
  // Completed repairs are added automatically (lines with a ticket_id).
  const tenancy = await db('tenancies').where('id', p.tenancy_id).first('property_id');
  const waiting = deductionsEditable(p) ? await db.transaction((trx) => applyRepairDeductions(trx, tenancy?.property_id)) : [];
  const items = await db('rent_payment_deductions').where('rent_payment_id', p.id).orderBy('id')
    .select('id', 'description', 'supplier', 'amount', 'ticket_id');
  res.json({
    success: true,
    data: {
      payment: { id: p.id, amount: Number(p.amount), fee_pct: Number(p.fee_pct || 0), fee_amount: Number(p.fee_amount || 0) },
      items: items.map((i) => ({ ...i, amount: Number(i.amount), from_maintenance: !!i.ticket_id })),
      // Repairs too big for what is left of this flat's open payments.
      repairs_waiting: waiting,
      max: landlordShare(p),
      editable: deductionsEditable(p)
    }
  });
});

// PUT /xero/rent-approvals/:id/deductions { items: [{ description, supplier, amount }] }
// Replaces the list. Refused when the total is more than the landlord's share.
export const saveRentDeductions = catchAsync(async (req, res) => {
  const p = await loadForDeductions(req.params.id);
  if (!deductionsEditable(p)) {
    throw new ApiError(409, 'The landlord bill for this payment is already in Xero, so its deductions can no longer change');
  }
  const raw = req.body?.items;
  if (!Array.isArray(raw)) throw new ApiError(400, 'items must be a list');
  if (raw.length > 30) throw new ApiError(400, 'At most 30 deductions on one payment');
  const items = raw.map((it, i) => {
    const description = String(it?.description ?? '').trim();
    const supplier = String(it?.supplier ?? '').trim();
    const amount = round2(Number(it?.amount));
    if (!description) throw new ApiError(400, `Deduction ${i + 1}: give a description`);
    if (description.length > 255 || supplier.length > 255) throw new ApiError(400, `Deduction ${i + 1}: description or supplier is too long`);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, `Deduction ${i + 1}: the amount must be more than £0`);
    return { description, supplier: supplier || null, amount };
  });
  // Repairs from Maintenance stay (they change on the ticket, not here).
  const repairs = round2((await db('rent_payment_deductions').where('rent_payment_id', p.id).whereNotNull('ticket_id').sum('amount as s').first())?.s || 0);
  const total = round2(items.reduce((s, i) => s + i.amount, 0) + repairs);
  const share = landlordShare(p);
  if (total > share) {
    throw new ApiError(400, `Deductions (£${total.toFixed(2)}) can't be more than the landlord's share (£${share.toFixed(2)})`);
  }
  const net = round2(share - total);
  await db.transaction(async (trx) => {
    await trx('rent_payment_deductions').where('rent_payment_id', p.id).whereNull('ticket_id').delete();
    if (items.length) {
      await trx('rent_payment_deductions').insert(items.map((i) => ({
        rent_payment_id: p.id, description: i.description, supplier: i.supplier, amount: i.amount.toFixed(2), created_by: req.user.id
      })));
    }
    await trx('rent_payments').where('id', p.id).update({ deductions_amount: total.toFixed(2), net_amount: net.toFixed(2) });
    await trx('audit_log').insert({
      actor_id: req.user.id, actor_role: req.user.role, action: 'RENT_DEDUCTIONS_SET',
      entity_type: 'rent_payment', entity_id: p.id,
      meta: JSON.stringify({ items, total, net }),
      ip_address: req.ip || null
    });
  });
  res.json({
    success: true,
    message: total > 0 ? `Deductions saved: £${total.toFixed(2)}, £${net.toFixed(2)} to the landlord` : 'No deductions on this payment',
    data: { total, net }
  });
});

// POST /xero/rent-invoices/pull-payments — check Xero for rent paid now.
export const pullRentPayments = catchAsync(async (req, res) => {
  const result = await pullInvoicePayments(req.user.id);
  const bills = await pullLandlordBillStatus();
  res.json({
    success: true,
    message: `Xero payments: ${result.recorded} new, ${result.linked} matched to typed-in payments, ${result.removed} removed`
      + (result.flagged ? `, ${result.flagged} need attention` : '')
      + (bills.paid ? `, ${bills.paid} landlord payment(s) seen` : ''),
    data: { ...result, landlord_bills: bills }
  });
});

// ── Send approved rent to Xero (separate approved-rent flow) ────────────────

// POST /xero/rent-approvals/:id/send-to-xero — bill to the landlord (rent − fee).
export const sendRentToXero = catchAsync(async (req, res) => {
  const result = await postLandlordBill(Number(req.params.id), req.user.id);
  if (result.status === 'failed') throw new ApiError(502, `Xero refused the bill: ${result.error}`);
  res.json({
    success: true,
    message: result.already
      ? `Already in Xero as ${result.number}`
      : `Sent to Xero: bill ${result.number} for £${result.net.toFixed(2)} to the landlord`,
    data: result
  });
});

// POST /xero/rent-approvals/send-all — every approved payment not yet in Xero.
export const sendAllRentToXero = catchAsync(async (req, res) => {
  const ids = await db('rent_payments').where('approval_status', 'approved')
    .where((w) => w.whereNull('xero_bill_status').orWhereIn('xero_bill_status', ['failed', 'voided'])).pluck('id');
  let sent = 0, failed = 0;
  for (const id of ids) {
    const r = await postLandlordBill(id, req.user.id);
    if (r.status === 'posted') sent++; else if (r.status === 'failed') failed++;
  }
  res.json({ success: true, message: `Sent to Xero: ${sent} bill(s)${failed ? `, ${failed} failed` : ''}`, data: { sent, failed } });
});

// POST /xero/rent-approvals/:id/undo-send — void the bill while the landlord is unpaid.
export const undoSendRentToXero = catchAsync(async (req, res) => {
  const result = await voidLandlordBill(Number(req.params.id), req.user.id);
  res.json({ success: true, message: `Bill ${result.number} voided in Xero`, data: result });
});
