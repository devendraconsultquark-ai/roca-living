import db from '../config/db.js';
import { toYmd } from './dateHelpers.js';
import { niceName } from './names.js';

// One list of every landlord statement, whatever made it (single source of
// truth for statements and landlord money, user 5 Nov 2026):
//   roca_living — Generate Statement (landlord_statements)
//   rent_cycle  — Rent Cycle "Make Statement" (approved_rent_statements)
//   historic    — made before Roca Living took over (historic_statements)
// The old months in Xero (rent_history) are the same months as historic
// statements; they are never counted again, only their Xero numbers are shown.
// Money totals everywhere are sums of this list.

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const ymd = (d) => (d ? toYmd(d) : null);

export const STATEMENT_TYPES = ['roca_living', 'rent_cycle', 'historic'];

// filters: { landlordId, propertyId, tenancyId, types, landlordView }
// landlordView: what a landlord may see (no Rent Cycle drafts).
export const listStatements = async (filters = {}) => {
  const { landlordId, propertyId, tenancyId, landlordView = false } = filters;
  const types = filters.types?.length ? filters.types : STATEMENT_TYPES;
  const rows = [];

  if (types.includes('roca_living')) {
    const q = db('landlord_statements as s')
      .leftJoin('tenancies as t', 's.tenancy_id', 't.id')
      .leftJoin('properties as p', 't.property_id', 'p.id')
      .leftJoin('users as u', 's.landlord_id', 'u.id')
      .select('s.*', 't.property_id', 'p.block_name', 'p.apartment_number', db.raw('COALESCE(u.name, s.landlord_name) as landlord_display'), 'u.email as landlord_email');
    if (landlordId) q.where('s.landlord_id', landlordId);
    if (propertyId) q.where('t.property_id', propertyId);
    if (tenancyId) q.where('s.tenancy_id', tenancyId);
    for (const s of await q) {
      rows.push({
        key: `rl-${s.id}`, type: 'roca_living', id: s.id, statement_number: s.statement_number || s.statement_reference || `STM-${s.id}`,
        has_invoice: !!s.invoice_id,
        flat: s.block_name ? `${String(s.block_name).toUpperCase()}-${s.apartment_number}` : null,
        property_id: s.property_id || null, tenancy_id: s.tenancy_id || null, landlord_id: s.landlord_id || null,
        landlord_name: niceName(s.landlord_display) || '', landlord_email: s.landlord_email || null, tenant_name: s.tenant_name || null,
        period_start: ymd(s.period_start), period_end: ymd(s.period_end), issued_on: ymd(s.generated_at || s.created_at),
        // Same reading as the Statements page always had: rent, money out of it, payout.
        rent: round2(s.gross_rent), fees: round2(Number(s.deductions || 0) + Number(s.nrl_withheld || 0)), net: round2(s.net_paid),
        status: String(s.status || 'draft').toLowerCase(), sent_at: s.sent_at ? new Date(s.sent_at).toISOString() : null,
        paid_on: s.paid_at ? ymd(s.paid_at) : null, xero_invoice_number: null, xero_bill_number: null
      });
    }
  }

  if (types.includes('rent_cycle')) {
    const q = db('approved_rent_statements as a')
      .leftJoin('properties as p', 'a.property_id', 'p.id')
      .leftJoin('users as u', 'a.landlord_id', 'u.id')
      .select('a.*', 'p.block_name', 'p.apartment_number', db.raw('COALESCE(u.name, a.landlord_name) as landlord_display'), 'u.email as landlord_email');
    if (landlordId) q.where('a.landlord_id', landlordId);
    if (propertyId) q.where('a.property_id', propertyId);
    if (tenancyId) q.where('a.tenancy_id', tenancyId);
    if (landlordView) q.whereNot('a.status', 'draft');
    const list = await q;
    // Paid = every landlord bill on it is paid in Xero.
    const pays = list.length
      ? await db('rent_payments').whereIn('approved_statement_id', list.map((a) => a.id)).select('approved_statement_id', 'xero_bill_status', 'xero_bill_number', 'landlord_paid_at')
      : [];
    for (const a of list) {
      const mine = pays.filter((p) => p.approved_statement_id === a.id);
      const paid = mine.length > 0 && mine.every((p) => p.xero_bill_status === 'paid');
      const paidOn = paid ? mine.map((p) => (p.landlord_paid_at ? ymd(p.landlord_paid_at) : null)).filter(Boolean).sort().pop() || null : null;
      rows.push({
        key: `ar-${a.id}`, type: 'rent_cycle', id: a.id, statement_number: a.statement_number,
        has_invoice: !!a.invoice_number,
        flat: a.block_name ? `${String(a.block_name).toUpperCase()}-${a.apartment_number}` : null,
        property_id: a.property_id || null, tenancy_id: a.tenancy_id || null, landlord_id: a.landlord_id || null,
        landlord_name: niceName(a.landlord_display) || '', landlord_email: a.landlord_email || null, tenant_name: null,
        period_start: ymd(a.period_start), period_end: ymd(a.period_end), issued_on: ymd(a.created_at),
        rent: round2(a.total_rent), fees: round2(Number(a.total_fee || 0) + Number(a.total_deductions || 0)), net: round2(a.net_payout),
        status: paid ? 'paid' : a.status === 'issued' ? 'sent' : 'draft', sent_at: a.sent_at ? new Date(a.sent_at).toISOString() : null,
        paid_on: paidOn, xero_invoice_number: null, xero_bill_number: [...new Set(mine.map((p) => p.xero_bill_number).filter(Boolean))].join(', ') || null
      });
    }
  }

  if (types.includes('historic') && (await db.schema.hasTable('historic_statements'))) {
    const q = db('historic_statements as h').join('properties as p', 'h.property_id', 'p.id')
      .select('h.*', 'p.landlord_id as owner_id', 'p.block_name', 'p.apartment_number');
    if (landlordId) q.where('p.landlord_id', landlordId);
    if (propertyId) q.where('h.property_id', propertyId);
    if (tenancyId) q.where('h.tenancy_id', tenancyId);
    const list = await q;
    // The same months in Xero (rent_history): show their Xero numbers, never count them again.
    const xero = list.length && (await db.schema.hasTable('rent_history'))
      ? await db('rent_history').where('status', 'done').whereIn('property_id', [...new Set(list.map((h) => h.property_id))])
        .select('property_id', 'landlord_paid', 'paid_on', 'xero_invoice_number', 'xero_bill_number')
      : [];
    for (const h of list) {
      const x = xero.find((r) => r.property_id === h.property_id && ymd(r.paid_on) === ymd(h.paid_on) && round2(r.landlord_paid) === round2(h.net_paid));
      rows.push({
        key: `h-${h.id}`, type: 'historic', id: h.id, statement_number: h.statement_number,
        has_invoice: !!h.invoice_number,
        flat: h.flat, property_id: h.property_id, tenancy_id: h.tenancy_id || null, landlord_id: h.owner_id || h.landlord_id || null,
        landlord_name: h.landlord_name || '', landlord_email: null, tenant_name: h.tenant_name || null,
        period_start: ymd(h.period_start), period_end: ymd(h.period_end), issued_on: ymd(h.issued_on),
        rent: round2(h.total_income), fees: round2(h.total_expenditure), net: round2(h.net_paid),
        status: h.paid_on ? 'paid' : 'sent', sent_at: null, paid_on: ymd(h.paid_on),
        has_original: !!h.original_document_id,
        xero_invoice_number: h.xero_invoice_number || x?.xero_invoice_number || null,
        xero_bill_number: h.xero_bill_number || x?.xero_bill_number || null
      });
    }
  }

  return rows.sort((a, b) => String(b.period_start || '').localeCompare(String(a.period_start || '')) || String(b.statement_number).localeCompare(String(a.statement_number)));
};

// Money from statements: rent and fees of issued statements (drafts left out),
// paid out = statements marked paid, pending = issued but not paid yet.
// year: count only statements whose period starts in that year (null = all).
export const statementTotals = (rows, { year = null } = {}) => {
  const issued = rows.filter((r) => r.status !== 'draft' && (!year || String(r.period_start || '').startsWith(String(year))));
  const sum = (list, k) => round2(list.reduce((s, r) => s + Number(r[k] || 0), 0));
  const paid = issued.filter((r) => r.status === 'paid');
  const pending = issued.filter((r) => r.status !== 'paid');
  return {
    count: issued.length,
    rent: sum(issued, 'rent'),
    fees: sum(issued, 'fees'),
    net: sum(issued, 'net'),
    paid_out: sum(paid, 'net'),
    pending_payout: sum(pending, 'net'),
    pending_count: pending.length,
    drafts: rows.filter((r) => r.status === 'draft').length
  };
};
