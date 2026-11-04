import db from '../config/db.js';
import { getSetting } from './settings.js';
import { toYmd } from './dateHelpers.js';
import { xeroThrottled as xero, xeroMessage, round2, contactNotFound } from './xeroRentInvoices.js';
import { landlordBillLines, feeTransferPayload } from './xeroLandlordBills.js';

// Rent months from before Roca Living (June – October 2026) into Xero, so the
// client's old bank lines can be reconciled with Match:
//   • a rent invoice to the tenant, paid by one payment per bank line;
//   • a landlord bill (rent, fee −, repairs −), paid on the payout day;
//   • a bank transfer for ROCA's fee (and for a repair moved to ROCA's account).
// Each month is also saved in rent_history (read-only history in Roca Living).
// It never touches rent_payments, schedules, approvals or statements.
//
// Only months that add up to the penny are given (rent − fee − repairs =
// payout); the file comes from the reconcile worksheet. A month already done
// is skipped; a month stopped halfway carries on from the step it reached.
// `call` is the Xero client (tests pass a fake).

const MARK = 'Before Roca Living';
const uk = (ymd) => ymd.split('-').reverse().join('/');
const pad2 = (n) => String(n).padStart(2, '0');
const monthName = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// The checks a month must pass before anything is sent.
export const checkMonth = (m) => {
  const rent = round2(m.rents.reduce((s, r) => s + Number(r.amount), 0));
  const fee = round2(m.fee ? Number(m.fee.amount) : 0);
  const repairs = round2((m.repairs || []).reduce((s, r) => s + Number(r.amount), 0));
  const problems = [];
  if (!/^\d+$/.test(String(m.flat))) problems.push('flat number missing');
  if (!m.rents.length) problems.push('no rent');
  if (round2(rent - fee - repairs) !== round2(m.payout.amount)) problems.push(`rent ${rent} − fee ${fee} − repairs ${repairs} ≠ payout ${m.payout.amount}`);
  return { rent, fee, repairs, problems };
};

// First free document number (Xero keeps voided numbers). A live document
// with this number made by this import (same total, our reference) is ours
// from a run that stopped halfway, so it is reused.
const chooseNumber = async (base, total, type, call) => {
  for (let v = 1; v <= 20; v++) {
    const number = v === 1 ? base : `${base}-${v}`;
    const ours = await db('rent_history').where('xero_invoice_number', number).orWhere('xero_bill_number', number).first('id');
    const rl = (await db('xero_rent_invoices').where('invoice_number', number).first('id'))
      || (await db('rent_payments').where('xero_bill_number', number).first('id'));
    if (ours || rl) continue;
    const r = await call('GET', '/Invoices', { searchParams: { InvoiceNumbers: number } });
    if (!r.ok) throw new Error(`Xero lookup of ${number} failed: ${xeroMessage(r.error)}`);
    const found = (r.body?.Invoices || []).find((i) => i.InvoiceNumber === number);
    if (!found) return { number, existing: null };
    if (found.Type === type && !['VOIDED', 'DELETED'].includes(found.Status) && Number(found.Total) === Number(total)
      && String(found.Reference || '').includes(MARK)) {
      return { number, existing: found };
    }
  }
  throw new Error(`No free number for ${base}`);
};

// PUT with one retry by name when a saved ContactID isn't in this Xero.
const putDoc = async (call, path, key, doc, byName) => {
  let r = await call('PUT', path, { searchParams: { summarizeErrors: 'false' }, body: { [key]: [doc] } });
  let made = r.body?.[key]?.[0];
  let errors = made?.ValidationErrors?.map((e) => e.Message).filter(Boolean) || [];
  if ((!r.ok || errors.length) && doc.Contact?.ContactID && contactNotFound(errors.join('; ') || xeroMessage(r.error))) {
    r = await call('PUT', path, { searchParams: { summarizeErrors: 'false' }, body: { [key]: [{ ...doc, Contact: byName }] } });
    made = r.body?.[key]?.[0];
    errors = made?.ValidationErrors?.map((e) => e.Message).filter(Boolean) || [];
  }
  if (!r.ok || errors.length) throw new Error(errors.join('; ') || xeroMessage(r.error) || `Xero refused ${path}`);
  return made;
};

const payments = async (call, list) => {
  const r = await call('PUT', '/Payments', { searchParams: { summarizeErrors: 'false' }, body: { Payments: list } });
  const made = r.body?.Payments || [];
  const errors = made.flatMap((p) => p.ValidationErrors?.map((e) => e.Message) || []).filter(Boolean);
  if (!r.ok || errors.length || made.length !== list.length) throw new Error(errors.join('; ') || xeroMessage(r.error) || 'Xero refused the payment');
  return made.map((p) => p.PaymentID);
};

// What Roca Living knows about the flat at that time.
const contextFor = async (m) => {
  const property = await db('properties').where({ block_name: m.block || 'PH', apartment_number: String(m.flat) }).first('id', 'landlord_id', 'block_name', 'apartment_number');
  if (!property) return { property: null };
  const first = m.rents.map((r) => r.date).sort()[0];
  const tenancy = await db('tenancies as t').leftJoin('tenants as lead', function () {
    this.on('lead.tenancy_id', 't.id').andOn('lead.is_lead_tenant', db.raw('1'));
  }).where('t.property_id', property.id).where('t.start_date', '<=', first).orderBy('t.start_date', 'desc')
    .first('t.id', 'lead.name as tenant_name');
  // Only the tenancy of the tenant who paid (an earlier tenant's month has none here).
  const sameTenant = tenancy && String(tenancy.tenant_name || '').toLowerCase() === String(m.tenant || '').toLowerCase();
  return { property, tenancyId: sameTenant ? tenancy.id : null };
};

const tenantContact = async (m, flatCode, tenancyId) => {
  const byName = { Name: `${m.tenant} (${flatCode})`.slice(0, 255) };
  if (!tenancyId) return { contact: byName, byName };
  const prev = await db('xero_rent_invoices').where('tenancy_id', tenancyId).whereNotNull('xero_contact_id').orderBy('id', 'desc').first('xero_contact_id');
  return { contact: prev ? { ContactID: prev.xero_contact_id } : byName, byName };
};
const landlordContact = async (m, landlordId) => {
  const byName = { Name: String(m.landlord || 'Landlord').slice(0, 255) };
  const link = landlordId ? await db('xero_contact_links').where({ kind: 'landlord', landlord_id: landlordId }).orderBy('id', 'desc').first('xero_contact_id') : null;
  return { contact: link ? { ContactID: link.xero_contact_id } : byName, byName };
};

export const importHistory = async ({ months, apply = false, call = xero, log = console.log }) => {
  const settings = {
    rentCode: await getSetting('xeroRentIncomeAccountCode', null),
    billCode: await getSetting('xeroLandlordBillAccountCode', null),
    feeCode: await getSetting('xeroFeeIncomeAccountCode', null),
    expenseCode: await getSetting('xeroLandlordExpenseAccountCode', null),
    rentBank: await getSetting('xeroRentBankAccountId', null),
    feeBank: await getSetting('xeroFeeBankAccountId', null),
  };
  const missing = Object.entries(settings).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Settings → Xero first: ${missing.join(', ')} not chosen`);

  const out = { done: 0, skipped: 0, would: 0, failed: 0, refused: 0 };
  for (const m of months) {
    const flatCode = `${(m.block || 'PH').toUpperCase()}-${m.flat}`;
    const { rent, fee, repairs, problems } = checkMonth(m);
    const label = `${flatCode} ${m.month_label}`;
    if (problems.length) { log(`REFUSED ${label}: ${problems.join('; ')}`); out.refused++; continue; }
    const { property, tenancyId } = await contextFor(m);
    if (!property) { log(`REFUSED ${label}: no flat ${flatCode} in Roca Living`); out.refused++; continue; }
    let row = await db('rent_history').where({ flat: flatCode, month_label: m.month_label }).first();
    if (row?.status === 'done') { log(`skip    ${label}: already done (${row.xero_invoice_number}, ${row.xero_bill_number})`); out.skipped++; continue; }

    const firstRent = m.rents.map((r) => r.date).sort()[0];
    const invBase = `RENT-${(m.block || 'PH').toUpperCase()}${pad2(m.flat)}-${firstRent.replace(/-/g, '')}`;
    const billBase = `PAY-${(m.block || 'PH').toUpperCase()}${pad2(m.flat)}-${m.payout.date.replace(/-/g, '')}`;
    const transfers = [...(m.fee ? [{ kind: 'fee', ...m.fee }] : []), ...(m.repairs || []).map((r) => ({ kind: 'repair', ...r }))];
    log(`${apply ? 'APPLY  ' : 'WOULD  '} ${label} · ${m.tenant} → ${m.landlord}`);
    log(`          invoice ${invBase} £${rent.toFixed(2)} paid by ${m.rents.map((r) => `£${Number(r.amount).toFixed(2)} on ${uk(r.date)}`).join(', ')}`);
    log(`          bill    ${billBase} £${Number(m.payout.amount).toFixed(2)} (rent £${rent.toFixed(2)}${fee ? ` − fee £${fee.toFixed(2)}` : ''}${repairs ? ` − repairs £${repairs.toFixed(2)}` : ''}) paid ${uk(m.payout.date)}`);
    for (const t of transfers) log(`          transfer £${Number(t.amount).toFixed(2)} on ${uk(t.date)} rent → fee account (${t.kind})`);
    if (!apply) { out.would++; continue; }

    try {
      if (!row) {
        const [id] = await db('rent_history').insert({
          property_id: property.id, tenancy_id: tenancyId, flat: flatCode, month_label: m.month_label,
          tenant_name: m.tenant, landlord_name: m.landlord, rent_total: rent.toFixed(2),
          parts: JSON.stringify(m.rents.map((r) => ({ date: r.date, amount: round2(r.amount) }))),
          fee: fee.toFixed(2), fee_date: m.fee?.date || null, repairs: repairs.toFixed(2),
          repair_parts: JSON.stringify((m.repairs || []).map((r) => ({ date: r.date, amount: round2(r.amount), description: r.description }))),
          landlord_paid: round2(m.payout.amount).toFixed(2), paid_on: m.payout.date, status: 'started'
        });
        row = await db('rent_history').where('id', id).first();
      }
      const save = async (fields) => { await db('rent_history').where('id', row.id).update(fields); row = { ...row, ...fields }; };

      // 1. Rent invoice, paid by one payment per bank line.
      if (!row.xero_invoice_id) {
        const { contact, byName } = await tenantContact(m, flatCode, tenancyId);
        const { number, existing } = await chooseNumber(invBase, rent.toFixed(2), 'ACCREC', call);
        const inv = existing || await putDoc(call, '/Invoices', 'Invoices', {
          Type: 'ACCREC', Contact: contact, Date: firstRent, DueDate: firstRent, InvoiceNumber: number,
          Reference: `${flatCode} ${MARK}`, Status: 'AUTHORISED', LineAmountTypes: 'NoTax',
          LineItems: [{ Description: `Rent ${flatCode} ${m.tenant}, ${monthName(firstRent)} (${MARK.toLowerCase()})`, Quantity: 1, UnitAmount: rent, AccountCode: settings.rentCode }]
        }, byName);
        await save({ xero_invoice_id: inv.InvoiceID, xero_invoice_number: inv.InvoiceNumber || number });
      }
      if (!row.xero_invoice_payment_ids) {
        const ids = await payments(call, m.rents.map((r) => ({
          Invoice: { InvoiceID: row.xero_invoice_id }, Account: { AccountID: settings.rentBank }, Date: r.date, Amount: round2(r.amount), Reference: `${flatCode} rent`
        })));
        await save({ xero_invoice_payment_ids: JSON.stringify(ids) });
      }

      // 2. Landlord bill, paid on the payout day.
      if (!row.xero_bill_id) {
        const { contact, byName } = await landlordContact(m, property.landlord_id);
        const lines = landlordBillLines(
          { flat: flatCode, tenantName: m.tenant, amount: rent, feePct: rent ? round2((fee / rent) * 100) : 0, fee,
            rents: m.rents.map((r) => ({ receivedUk: uk(r.date), amount: round2(r.amount) })) },
          (m.repairs || []).map((r) => ({ description: r.description || 'Repair', supplier: null, amount: r.amount })),
          { bill: settings.billCode, fee: settings.feeCode, expense: settings.expenseCode }
        );
        const { number, existing } = await chooseNumber(billBase, round2(m.payout.amount).toFixed(2), 'ACCPAY', call);
        const bill = existing || await putDoc(call, '/Invoices', 'Invoices', {
          Type: 'ACCPAY', Contact: contact, Date: m.payout.date, DueDate: m.payout.date, InvoiceNumber: number,
          Reference: `${flatCode} ${MARK}`, Status: 'AUTHORISED', LineAmountTypes: 'NoTax', LineItems: lines
        }, byName);
        await save({ xero_bill_id: bill.InvoiceID, xero_bill_number: bill.InvoiceNumber || number });
      }
      if (!row.xero_bill_payment_id) {
        const [pid] = await payments(call, [{
          Invoice: { InvoiceID: row.xero_bill_id }, Account: { AccountID: settings.rentBank }, Date: m.payout.date, Amount: round2(m.payout.amount), Reference: `${flatCode} landlord`
        }]);
        await save({ xero_bill_payment_id: pid });
      }

      // 3. ROCA's fee (and a repair) moved to ROCA's account.
      const done = (typeof row.xero_transfer_ids === 'string' ? JSON.parse(row.xero_transfer_ids) : row.xero_transfer_ids) || [];
      for (let i = done.length; i < transfers.length; i++) {
        const t = transfers[i];
        const made = await putDoc(call, '/BankTransfers', 'BankTransfers', feeTransferPayload({
          from: settings.rentBank, to: settings.feeBank, amount: t.amount, date: t.date,
          reference: t.kind === 'fee' ? `MF ${flatCode} ${row.xero_bill_number}` : `${flatCode} repair ${row.xero_bill_number}`
        }));
        done.push(made.BankTransferID);
        await save({ xero_transfer_ids: JSON.stringify(done) });
      }
      await save({ status: 'done', error: null });
      log(`          done: ${row.xero_invoice_number}, ${row.xero_bill_number}, ${done.length} transfer(s)`);
      out.done++;
    } catch (err) {
      out.failed++;
      if (row?.id) await db('rent_history').where('id', row.id).update({ error: String(err.message).slice(0, 500) });
      log(`FAILED  ${label}: ${err.message} (run again to carry on from here)`);
    }
  }
  return out;
};

// Read-only history for Roca Living's pages.
export const historyRows = (q) => q.select('*').then((rows) => rows.map((r) => ({
  ...r,
  parts: typeof r.parts === 'string' ? JSON.parse(r.parts) : r.parts,
  repair_parts: typeof r.repair_parts === 'string' ? JSON.parse(r.repair_parts) : r.repair_parts,
  paid_on: toYmd(r.paid_on), fee_date: r.fee_date ? toYmd(r.fee_date) : null,
  rent_total: Number(r.rent_total), fee: Number(r.fee), repairs: Number(r.repairs), landlord_paid: Number(r.landlord_paid)
})));
