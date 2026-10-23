import db from '../config/db.js';
import { ApiError } from './ApiError.js';
import { toYmd } from './dateHelpers.js';

// Property statement for any From–To range (as PayProp's "Property statement"):
// income and expenses, the tenant's (debtor) account, fees and costs
// (creditors), what is held for / paid to the owner, and a dated cash flow.
//
// Read-only and built from the source records, never from the ledger:
// - money in   = rent payments recorded for the property's tenancies (by date received)
// - money out  = what issued statements deducted (fees, VAT, costs; dated by the
//               statement's period end, as the ledger does) and the landlord payout
//               (when the statement is marked paid; Rent Cycle statements pay out
//               through the Xero landlord bill, so on issue)
// - tenant     = rent months due vs payments received
// Draft statements are left out: nothing has been deducted or paid on them.

const MAX_MONTHS = 12;
const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (rows, f) => round(rows.reduce((s, r) => s + (Number(f(r)) || 0), 0));
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const between = (d, from, to) => d && d >= from && d <= to;

const monthsBetween = (from, to) => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + (td >= fd ? 0 : -1);
};

const feeOf = (s) => ({
  fee: round(Number(s.mgmt_fee || 0) + Number(s.roca_letting_fee || 0) + Number(s.agent_letting_fee || 0)),
  vat: round(s.mgmt_fee_vat || 0),
});

const renderLines = (s) => {
  const raw = typeof s.render_data === 'string' ? (() => { try { return JSON.parse(s.render_data); } catch { return null; } })() : s.render_data;
  return raw?.statementData?.expenditure_lines || [];
};

export const buildPropertyStatement = async (propertyId, from, to) => {
  if (!isYmd(from) || !isYmd(to) || from > to) throw new ApiError(400, 'Choose a valid From and To date');
  if (monthsBetween(from, to) >= MAX_MONTHS) throw new ApiError(400, 'The date range cannot be longer than 12 months');

  const property = await db('properties as p')
    .leftJoin('users as u', 'p.landlord_id', 'u.id')
    .where('p.id', propertyId)
    .first('p.id', 'p.name', 'p.address_line1', 'p.address_line2', 'p.city', 'p.postcode', 'p.property_reference', 'p.apartment_number', 'p.block_name',
      'u.name as landlord_name', 'u.address as landlord_address');
  if (!property) throw new ApiError(404, 'Property not found');

  const tenancies = await db('tenancies').where('property_id', propertyId).select('id', 'status', 'start_date', 'end_date');
  const tenancyIds = tenancies.map((t) => t.id);
  const ids = tenancyIds.length ? tenancyIds : [0];
  const leads = await db('tenants').whereIn('tenancy_id', ids).orderBy('is_lead_tenant', 'desc').select('tenancy_id', 'name');
  const tenantOf = (tid) => leads.find((l) => l.tenancy_id === tid)?.name || 'Tenant';

  // Money in: rent payments
  const payments = (await db('rent_payments').whereIn('tenancy_id', ids)
    .select('id', 'tenancy_id', 'amount', 'received_at', 'method', 'reference'))
    .map((p) => ({ ...p, date: toYmd(p.received_at), amount: round(p.amount) }));

  // Rent due (tenant account)
  const schedules = (await db('rent_schedules').whereIn('tenancy_id', ids).select('tenancy_id', 'due_date', 'amount'))
    .map((s) => ({ ...s, date: toYmd(s.due_date), amount: round(s.amount) }));

  // Money out: issued statements (Generate Statement) and issued Rent Cycle statements
  const statements = (await db('landlord_statements')
    .where((w) => w.whereIn('tenancy_id', ids).orWhere((x) => x.whereNull('tenancy_id').where({ source: 'local', source_property_id: propertyId })))
    .whereNot('status', 'draft')
    .select('id', 'statement_number', 'tenancy_id', 'status', 'period_start', 'period_end', 'total_income', 'total_expenditure', 'deductions',
      'mgmt_fee', 'mgmt_fee_vat', 'roca_letting_fee', 'agent_letting_fee', 'net_paid', 'paid_at', 'render_data'))
    .map((s) => ({ ...s, date: toYmd(s.period_end), paidDate: s.status === 'paid' ? toYmd(s.paid_at) || toYmd(s.period_end) : null }));
  const rentCycle = (await db('approved_rent_statements').where('property_id', propertyId).where('status', 'issued')
    .select('id', 'statement_number', 'tenancy_id', 'period_end', 'total_fee', 'total_deductions', 'net_payout', 'created_at'))
    .map((a) => ({ ...a, date: toYmd(a.period_end), paidDate: toYmd(a.created_at) }));

  // Every money-out item, dated
  const outItems = [];
  for (const s of statements) {
    const { fee, vat } = feeOf(s);
    const total = round(s.total_expenditure ?? s.deductions);
    const otherLines = renderLines(s).filter((l) => !/^Invoice No\./i.test(String(l.description || '')));
    const otherTotal = round(Math.max(0, total - fee - vat));
    if (fee) outItems.push({ date: s.date, kind: 'fee', description: `Management & letting fees — ${s.statement_number}`, amount: fee, vat, ref: s.statement_number });
    else if (vat) outItems.push({ date: s.date, kind: 'fee', description: `VAT on fees — ${s.statement_number}`, amount: 0, vat, ref: s.statement_number });
    if (otherTotal) {
      const listed = sum(otherLines, (l) => l.amount);
      if (otherLines.length && Math.abs(listed - otherTotal) < 0.01) {
        for (const l of otherLines) outItems.push({ date: s.date, kind: 'cost', description: `${l.description} — ${s.statement_number}`, amount: round(l.amount), vat: 0, ref: s.statement_number });
      } else {
        outItems.push({ date: s.date, kind: 'cost', description: `Costs deducted — ${s.statement_number}`, amount: otherTotal, vat: 0, ref: s.statement_number });
      }
    }
  }
  for (const a of rentCycle) {
    if (Number(a.total_fee)) outItems.push({ date: a.date, kind: 'fee', description: `Management fee — ${a.statement_number}`, amount: round(a.total_fee), vat: 0, ref: a.statement_number });
    if (Number(a.total_deductions)) outItems.push({ date: a.date, kind: 'cost', description: `Costs deducted — ${a.statement_number}`, amount: round(a.total_deductions), vat: 0, ref: a.statement_number });
  }
  const payouts = [
    ...statements.filter((s) => s.paidDate).map((s) => ({ date: s.paidDate, description: `Paid to owner — ${s.statement_number}`, amount: round(s.net_paid), ref: s.statement_number })),
    ...rentCycle.filter((a) => Number(a.net_payout)).map((a) => ({ date: a.paidDate, description: `Paid to owner (Xero landlord bill) — ${a.statement_number}`, amount: round(a.net_payout), ref: a.statement_number })),
  ];

  const inRange = (rows) => rows.filter((r) => between(r.date, from, to));
  const before = (rows) => rows.filter((r) => r.date && r.date < from);
  const outTotal = (r) => r.amount + (r.vat || 0);

  // Income and expenses
  const periodPayments = inRange(payments);
  const periodOut = inRange(outItems);
  const incomeByTenancy = tenancyIds
    .map((tid) => ({ tid, amount: sum(periodPayments.filter((p) => p.tenancy_id === tid), (p) => p.amount) }))
    .filter((x) => x.amount);
  const income = sum(periodPayments, (p) => p.amount);
  const fees = periodOut.filter((o) => o.kind === 'fee');
  const costs = periodOut.filter((o) => o.kind === 'cost');
  const feeNet = sum(fees, (o) => o.amount);
  const feeVat = sum(fees, (o) => o.vat);
  const costTotal = sum(costs, (o) => o.amount);
  const expenditure = round(feeNet + feeVat + costTotal);

  // Tenant (debtor) account
  const debtorOpening = round(sum(before(schedules), (s) => s.amount) - sum(before(payments), (p) => p.amount));
  const rentInvoiced = sum(inRange(schedules), (s) => s.amount);
  const debtorClosing = round(debtorOpening + rentInvoiced - income);

  // Owner account (money held for the landlord)
  const ownerOpening = round(sum(before(payments), (p) => p.amount) - sum(before(outItems), outTotal) - sum(before(payouts), (p) => p.amount));
  const netReturn = round(income - expenditure);
  const paidToOwner = sum(inRange(payouts), (p) => p.amount);
  const ownerClosing = round(ownerOpening + netReturn - paidToOwner);

  // Cash flow (dated, running balance from the owner opening balance)
  const flow = [
    ...periodPayments.map((p) => ({ date: p.date, type: 'Payment received', description: tenantOf(p.tenancy_id) + (p.reference ? ` (${p.reference})` : ''), received: p.amount, paid: 0 })),
    ...periodOut.map((o) => ({ date: o.date, type: o.kind === 'fee' ? 'Fees' : 'Costs', description: o.description, received: 0, paid: outTotal(o) })),
    ...inRange(payouts).map((p) => ({ date: p.date, type: 'Payment to owner', description: p.description, received: 0, paid: p.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (b.received - a.received));
  let running = ownerOpening;
  for (const f of flow) { running = round(running + f.received - f.paid); f.balance = running; }

  const address = [property.address_line1, property.address_line2, property.city, property.postcode].filter(Boolean).join(', ');
  return {
    property: {
      id: property.id,
      name: property.name || property.address_line1,
      address,
      reference: property.property_reference,
      unit: property.block_name && property.apartment_number ? `${property.block_name}-${property.apartment_number}` : null,
    },
    owner: { name: property.landlord_name || '—', address: property.landlord_address || '' },
    period: { from, to },
    income_expenses: {
      lines: [
        ...incomeByTenancy.map((x) => ({ type: 'Rent received', description: tenantOf(x.tid), vat: 0, income: x.amount, expenditure: 0 })),
        ...(feeNet || feeVat ? [{ type: 'Fees', description: 'ROCA Living management & letting fees', vat: feeVat, income: 0, expenditure: round(feeNet + feeVat) }] : []),
        ...(costTotal ? [{ type: 'Costs', description: 'Repairs and other costs deducted', vat: 0, income: 0, expenditure: costTotal }] : []),
      ],
      detail: [
        ...periodPayments.map((p) => ({ date: p.date, type: 'Rent received', description: tenantOf(p.tenancy_id) + (p.reference ? ` (${p.reference})` : ''), vat: 0, income: p.amount, expenditure: 0 })),
        ...periodOut.map((o) => ({ date: o.date, type: o.kind === 'fee' ? 'Fees' : 'Costs', description: o.description, vat: o.vat || 0, income: 0, expenditure: outTotal(o) })),
      ].sort((a, b) => a.date.localeCompare(b.date)),
      total_income: income,
      total_vat: feeVat,
      total_expenditure: expenditure,
      net_return: netReturn,
    },
    debtor: { opening: debtorOpening, rent_invoiced: rentInvoiced, payments_received: income, closing: debtorClosing },
    creditor: { opening: 0, fees_charged: round(feeNet + feeVat), costs_charged: costTotal, payments_made: expenditure, closing: 0 },
    owner_summary: { opening: ownerOpening, return_for_period: netReturn, paid_to_owner: paidToOwner, closing: ownerClosing },
    cash_flow: { opening: ownerOpening, lines: flow, closing: ownerClosing },
    notes: [
      'Rent is shown when it was received. Fees and costs are shown on the end date of the statement that deducted them.',
      'Draft statements are not included.',
    ],
    generated_on: toYmd(new Date()),
  };
};
