import db from '../config/db.js';
import { catchAsync } from '../utils/catchAsync.js';
import { toYmd } from '../utils/dateHelpers.js';

// Accounting → Payments Received: every rent payment the money came in for,
// from real records only.
//  - Roca Living: rent_payments (typed in or matched from Xero), with where it
//    is in the Rent Cycle.
//  - Before Roca Living: the parts of each rent_history month (the client's old
//    bank lines, put into Xero by the history import).
// Roca Living records no service charge, fee or other income, so none is shown.

const flatOf = (blockName, apt) => (blockName && apt ? `${String(blockName).toUpperCase()}-${apt}` : null);

const stageOf = (p) => {
  if (p.landlord_paid_at) return 'Landlord Paid';
  if (p.approval_status === 'approved') return 'Approved';
  if (p.approval_status === 'pending' || !p.approval_status) return 'To Approve';
  return String(p.approval_status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// GET /accounting/payments-received
export const getPaymentsReceived = catchAsync(async (req, res) => {
  const rl = await db('rent_payments as rp')
    .join('tenancies as t', 'rp.tenancy_id', 't.id')
    .join('properties as p', 't.property_id', 'p.id')
    .leftJoin('tenants as tn', function joinLead() {
      this.on('tn.tenancy_id', '=', 't.id').andOn('tn.is_lead_tenant', '=', db.raw('1'));
    })
    .leftJoin('users as l', 'p.landlord_id', 'l.id')
    .select(
      'rp.id', 'rp.received_at', 'rp.amount', 'rp.method', 'rp.reference', 'rp.xero_payment_id', 'rp.xero_invoice_number',
      'rp.approval_status', 'rp.landlord_paid_at', 'rp.tenancy_id',
      'p.id as property_id', 'p.block_name', 'p.apartment_number', 'p.name as property_name',
      'tn.id as tenant_id', 'tn.name as tenant_name', 'l.name as landlord_name',
    );

  const history = await db('rent_history').where('status', 'done')
    .select('id', 'property_id', 'tenancy_id', 'flat', 'month_label', 'tenant_name', 'landlord_name', 'parts', 'xero_invoice_number');

  const rows = [
    ...rl.map((p) => ({
      key: `rl-${p.id}`,
      source: 'roca_living',
      date: toYmd(p.received_at),
      amount: Number(p.amount),
      flat: flatOf(p.block_name, p.apartment_number) || p.property_name,
      property_id: p.property_id,
      tenancy_id: p.tenancy_id,
      tenant_id: p.tenant_id || null,
      tenant: p.tenant_name || '—',
      landlord: p.landlord_name || '—',
      method: p.xero_payment_id ? 'Bank (matched in Xero)' : (p.method ? String(p.method).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Typed In'),
      matched: !!p.xero_payment_id,
      reference: p.reference || p.xero_invoice_number || '—',
      stage: stageOf(p),
    })),
    ...history.flatMap((h) => {
      const parts = typeof h.parts === 'string' ? JSON.parse(h.parts) : (h.parts || []);
      return parts.map((part, i) => ({
        key: `h-${h.id}-${i}`,
        source: 'before_roca_living',
        date: String(part.date).slice(0, 10),
        amount: Number(part.amount),
        flat: h.flat,
        property_id: h.property_id,
        tenancy_id: h.tenancy_id,
        tenant_id: null,
        tenant: h.tenant_name || '—',
        landlord: h.landlord_name || '—',
        method: 'Bank (old bank line)',
        matched: true,
        reference: h.xero_invoice_number || '—',
        stage: 'Before Roca Living',
      }));
    }),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : String(a.flat).localeCompare(String(b.flat), 'en', { numeric: true })));

  res.json({ success: true, data: rows });
});
