import { toYmd } from './dateHelpers.js';

// Completed repairs come off the landlord's share automatically (Rent Cycle):
// a maintenance ticket marked Complete with a cost (final invoice, else quote)
// becomes one deduction "Repair – <title> (ticket #id)" on the flat's oldest
// rent payment whose landlord bill isn't in Xero yet, so the bill matches the
// statement (which lists the same repair). Each ticket is deducted once
// (rent_payment_deductions.ticket_id is unique). A repair larger than what is
// left of a payment's landlord share isn't split: it waits for a payment it
// fits. Only tickets completed on/after the "repairDeductionsFrom" setting (the
// day this was switched on) and on/after the tenancy's "Rent handled in Roca
// Living from" date count — older repairs were settled by hand.

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// The most ROCA may spend on one repair on this flat without asking the
// landlord first: the landlord's own limit, else the default in Settings.
export const repairLimitFor = async (conn, propertyId) => {
  const row = await conn('properties as p').leftJoin('landlord_profiles as lp', 'lp.user_id', 'p.landlord_id')
    .where('p.id', propertyId).first('lp.repair_limit');
  if (row?.repair_limit !== null && row?.repair_limit !== undefined) return { limit: round2(row.repair_limit), source: 'landlord' };
  const value = Number((await conn('settings').where('key', 'repairApprovalLimit').first('value'))?.value);
  return { limit: Number.isFinite(value) ? round2(value) : 250, source: 'default' };
};
export const ticketCost = (t) => round2(t.invoice_amount ?? t.quote_amount ?? 0);
export const repairDescription = (t) => `Repair – ${t.title} (ticket #${t.id})`;

// The landlord bill can still change (no bill in Xero, or it failed / was voided).
const billOpen = (p) => ['pending', 'approved'].includes(p.approval_status)
  && (!p.xero_bill_status || ['failed', 'voided'].includes(p.xero_bill_status));

const shareOf = (p) => round2(Number(p.amount) - Number(p.fee_amount || 0));

const deductedOn = async (trx, paymentId) => round2(
  (await trx('rent_payment_deductions').where('rent_payment_id', paymentId).sum('amount as s').first())?.s || 0
);

// Keep the payment's totals in step with its deduction lines.
const refreshTotals = async (trx, p) => {
  const total = await deductedOn(trx, p.id);
  await trx('rent_payments').where('id', p.id).update({ deductions_amount: total.toFixed(2), net_amount: round2(shareOf(p) - total).toFixed(2) });
};

// Bring one flat's repair deductions up to date. Returns the repairs still
// waiting because no open payment had room: [{ id, title, cost }].
export const applyRepairDeductions = async (trx, propertyId) => {
  if (!propertyId) return [];
  const from = (await trx('settings').where('key', 'repairDeductionsFrom').first('value'))?.value;
  if (!from) return [];
  const tickets = await trx('maintenance_tickets as m')
    .leftJoin('contractors as c', 'm.contractor_id', 'c.id')
    .where({ 'm.property_id': propertyId, 'm.status': 'complete' })
    .where('m.completed_at', '>=', `${from} 00:00:00`)
    .orderBy('m.completed_at').orderBy('m.id')
    .select('m.id', 'm.title', 'm.quote_amount', 'm.invoice_amount', 'm.completed_at', 'c.company_name as supplier');
  if (!tickets.length) return [];

  const payments = await trx('rent_payments as p')
    .join('tenancies as t', 'p.tenancy_id', 't.id')
    .where('t.property_id', propertyId)
    .whereIn('p.approval_status', ['pending', 'approved'])
    .orderBy('p.received_at').orderBy('p.id')
    .select('p.id', 'p.amount', 'p.fee_amount', 'p.approval_status', 'p.xero_bill_status', 't.statements_from', 't.start_date');
  const open = payments.filter(billOpen);
  const openIds = new Set(open.map((p) => p.id));
  const byId = new Map(payments.map((p) => [p.id, p]));
  const rows = await trx('rent_payment_deductions').whereIn('ticket_id', tickets.map((t) => t.id)).select('id', 'ticket_id', 'rent_payment_id', 'amount', 'description');
  const rowOf = new Map(rows.map((r) => [r.ticket_id, r]));
  const touched = new Set();
  const waiting = [];

  for (const t of tickets) {
    const cost = ticketCost(t);
    const row = rowOf.get(t.id);
    if (row) {
      // On a bill already in Xero: final.
      if (!openIds.has(row.rent_payment_id)) continue;
      const p = byId.get(row.rent_payment_id);
      const room = round2(shareOf(p) - (await deductedOn(trx, p.id)) + Number(row.amount));
      if (cost > 0 && cost <= room) {
        if (round2(row.amount) !== cost || row.description !== repairDescription(t)) {
          await trx('rent_payment_deductions').where('id', row.id).update({ amount: cost.toFixed(2), description: repairDescription(t), supplier: t.supplier || null });
          touched.add(p.id);
        }
        continue;
      }
      // Cost now nothing, or too big for this payment: take it off and place it again.
      await trx('rent_payment_deductions').where('id', row.id).delete();
      touched.add(p.id);
    }
    if (cost <= 0) continue;
    const done = toYmd(t.completed_at);
    let placed = false;
    for (const p of open) {
      if (done < toYmd(p.statements_from || p.start_date)) continue;
      if (cost <= round2(shareOf(p) - (await deductedOn(trx, p.id)))) {
        await trx('rent_payment_deductions').insert({
          rent_payment_id: p.id, ticket_id: t.id, description: repairDescription(t), supplier: t.supplier || null, amount: cost.toFixed(2),
        });
        touched.add(p.id);
        placed = true;
        break;
      }
    }
    if (!placed && open.length) waiting.push({ id: t.id, title: t.title, cost });
  }
  for (const id of touched) await refreshTotals(trx, byId.get(id));
  return waiting;
};
