import { estateDisplayFor } from './estatesLink.js';
import { formatNrl } from './statementNumbering.js';
import { toYmd } from './dateHelpers.js';

// Historic statements (made outside Roca Living before it took over): the
// statement + invoice data for the existing PDF template, built from the
// stored figures. Figures are exactly as the bank shows them; names, addresses
// and NRL numbers come from today's data (ROCA Estates), the same as
// approvedRentStatementController.landlordDetails.

const TENANCY_TYPE = 'Assured Periodic (APT)';
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v) || [];

export const historicLandlordDetails = async (property, fallbackName) => {
  const live = await estateDisplayFor(property.rocaem_property_id);
  const initials = live?.statement_initials || '';
  return {
    landlord_name: live?.landlord_name || fallbackName || '',
    landlord_address: live?.landlord_address || '',
    nrl_number: live?.nrl_formatted || formatNrl(live?.nrl_number || '', initials),
    property_address: live?.property_address || [property.address_line1, property.address_line2, property.city, property.postcode].filter(Boolean).join(', ')
  };
};

// h: a historic_statements row (or the same fields from the import JSON).
export const historicDocData = (h, property, details, tenancyStart) => {
  const block = String(property.block_name || 'PH').toUpperCase();
  const flat = `${block}-${property.apartment_number}`;
  const invoiceLines = parse(h.invoice_lines);
  const gross = round2(invoiceLines.reduce((s, l) => s + Number(l.cost || 0), 0));
  const discount = round2(invoiceLines.reduce((s, l) => s + Number(l.discount || 0), 0));
  const common = {
    landlord_name: details.landlord_name,
    landlord_address: details.landlord_address,
    property_address: details.property_address,
    tenant_name: h.tenant_name || '',
    tenancy_start_date: tenancyStart || null,
    tenancy_type: TENANCY_TYPE,
    period_start: toYmd(h.period_start),
    period_end: toYmd(h.period_end),
    issue_date: h.issued_on ? toYmd(h.issued_on) : toYmd(h.period_start)
  };
  const statementData = {
    ...common,
    statement_number: h.statement_number,
    nrl_number: details.nrl_number,
    landlord_reference: `RL_LR_${block}_${property.apartment_number}`,
    property_reference: flat,
    previous_balance: 0,
    income_lines: parse(h.income_lines).map((l) => ({ description: l.description, amount: round2(l.amount) })),
    expenditure_lines: parse(h.expenditure_lines).map((l) => ({ description: l.description, amount: round2(l.amount) })),
    total_income: round2(h.total_income),
    total_expenditure: round2(h.total_expenditure),
    payment_amount: round2(h.net_paid ?? h.payment_amount),
    // "Transferred" once the bank shows the payout.
    payment_confirmed: !!h.paid_on
  };
  const invoiceData = invoiceLines.length ? {
    ...common,
    invoice_number: h.invoice_number,
    service_level: 'Fully Managed',
    notes: h.invoice_notes || '',
    line_items: invoiceLines.map((l) => ({ description: l.description, cost: round2(l.cost), vat_percent: 0, discount: round2(l.discount || 0) })),
    total_gross: gross,
    total_vat: 0,
    total_discount: discount,
    total_net: round2(gross - discount)
  } : null;
  return { statementData, invoiceData };
};
