// A rent month can be paid in parts (£150, £200, £122.50 …): each Xero payment
// on the month's rent invoice is its own rent_payments row. They are settled
// together — one landlord bill, one fee transfer — once the rent is complete
// (or when the admin settles what has arrived so far). The rows settled together
// share settlement_lead_id (the latest of them, which carries the deductions).
//
// Before settling, the "open group" of a payment is every payment for the same
// rent month (same Xero rent invoice) not yet on a landlord bill in Xero.
import { toYmd } from './dateHelpers.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// The landlord bill can still change (no bill in Xero, or it failed / was voided).
export const billOpen = (p) => ['pending', 'approved'].includes(p.approval_status)
  && (!p.xero_bill_status || ['failed', 'voided'].includes(p.xero_bill_status));

export const shareOf = (p) => round2(Number(p.amount) - Number(p.fee_amount || 0));

// Which open group a payment belongs to.
export const groupKey = (p) => (p.settlement_lead_id
  ? `lead:${p.settlement_lead_id}`
  : `${p.tenancy_id}|${p.xero_invoice_number || `payment:${p.id}`}`);

// The payment the bill and deductions go on: the latest one.
export const latestOf = (list) => [...list].sort((a, b) => toYmd(a.received_at).localeCompare(toYmd(b.received_at)) || a.id - b.id).pop();

// The open group of one payment (itself included), oldest first.
export const openGroupOf = async (conn, paymentId) => {
  const p = await conn('rent_payments').where('id', paymentId).first();
  if (!p) return [];
  const q = p.settlement_lead_id
    ? conn('rent_payments').where('settlement_lead_id', p.settlement_lead_id)
    : conn('rent_payments').where({ tenancy_id: p.tenancy_id }).whereNull('settlement_lead_id')
      .where((w) => (p.xero_invoice_number ? w.where('xero_invoice_number', p.xero_invoice_number) : w.where('id', p.id)));
  const rows = await q.orderBy('received_at').orderBy('id');
  return rows.filter((r) => r.id === p.id || billOpen(r));
};

// A settled part stands for its whole settlement: the lead.
export const leadIdOf = async (conn, paymentId) => (await conn('rent_payments').where('id', paymentId).first('settlement_lead_id'))?.settlement_lead_id || Number(paymentId);

// Fee on the group's total (8% of £595 = £47.60), not the sum of rounded parts.
export const groupFee = (list) => round2(list.reduce((s, p) => s + (Number(p.amount) * Number(p.fee_pct ?? 8)) / 100, 0));
