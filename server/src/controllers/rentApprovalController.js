import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { toYmd } from '../utils/dateHelpers.js';
import { pullInvoicePayments, splitFor } from '../utils/xeroRentInvoices.js';
import { postLandlordBill, voidLandlordBill, pullLandlordBillStatus } from '../utils/xeroLandlordBills.js';

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
