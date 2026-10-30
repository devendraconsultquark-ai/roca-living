import db from '../config/db.js';
import logger from './logger.js';
import { ApiError } from './ApiError.js';
import { getSetting } from './settings.js';
import { toYmd, todayYmd as todayYmdLocal } from './dateHelpers.js';
import { getStoredConnection } from './xero.js';
import { xeroThrottled as xero, xeroMessage, xeroDateYmd, round2, contactNotFound } from './xeroRentInvoices.js';
import { applyRepairDeductions } from './repairDeductions.js';

// "Send to Xero" for approved rent (rent cycle phase 4, separate approved-rent
// flow — the existing statements are not involved). One bill to the landlord
// per approved rent payment:
//   line 1  rent received                 +£595.00  → landlord bills account
//   line 2  management fee 8%             −£47.60   → management fee income
//   line 3… deductions (cleaning, repairs) −£…       → landlord expenses account
//   total   what ROCA owes the landlord    £547.40 (less any deductions)
// When the admin pays the landlord from the bank, Xero matches that line to the
// bill; Roca Living reads the bill's status and shows the landlord as paid.

const pad2 = (n) => String(n).padStart(2, '0');
const uk = (ymd) => ymd.split('-').reverse().join('/');

const contactByName = (name) => ({ Name: (String(name || '').trim() || 'Landlord').slice(0, 255) });
const landlordContactFor = async (landlordId, name) => {
  const link = landlordId ? await db('xero_contact_links').where({ kind: 'landlord', landlord_id: landlordId }).orderBy('id', 'desc').first('xero_contact_id') : null;
  return link ? { ContactID: link.xero_contact_id } : contactByName(name);
};


// First free bill number (Xero keeps voided numbers): PAY-PH08-20261002, -2, …
// A live bill already in Xero with that number and total but missing here is
// ours from an interrupted run, so it is reused.
// Is this Xero document for the contact we would send? (ContactID, else name)
const sameContact = (found, contact) => (contact.ContactID
  ? found.Contact?.ContactID === contact.ContactID
  : String(found.Contact?.Name || '').trim().toLowerCase() === String(contact.Name || '').trim().toLowerCase());

// `table` holds the numbers already used here (landlord bills on rent_payments,
// contractor bills on rent_payment_deductions).
const chooseNumber = async (base, total, contact, call = xero, table = 'rent_payments') => {
  for (let v = 1; v <= 20; v++) {
    const number = v === 1 ? base : `${base}-${v}`;
    if (await db(table).where('xero_bill_number', number).first('id')) continue;
    const r = await call('GET', '/Invoices', { searchParams: { InvoiceNumbers: number } });
    if (!r.ok) throw new Error(`Xero bill lookup failed: ${xeroMessage(r.error)}`);
    const found = (r.body?.Invoices || []).find((i) => i.InvoiceNumber === number);
    if (!found) return { number, existing: null };
    // Only an approved, still unpaid bill can be ours from an interrupted run;
    // anything else with this number (paid, voided) means: take the next number.
    if (found.Type === 'ACCPAY' && found.Status === 'AUTHORISED' && Number(found.AmountPaid || 0) === 0 && Number(found.Total) === Number(total) && sameContact(found, contact)) {
      return { number, existing: found };
    }
  }
  throw new Error(`No free bill number for ${base}`);
};
const chooseBillNumber = (base, total, contact) => chooseNumber(base, total, contact);

// The bill's lines: rent (+), ROCA's fee (−) and each deduction (−). Their sum
// is what ROCA owes the landlord (the payment's net).
export const landlordBillLines = ({ flat, tenantName, receivedUk, amount, feePct, fee }, deductions, codes) => {
  const lines = [{
    Description: `Rent ${flat} ${tenantName || ''}, received ${receivedUk}`.replace(/\s+/g, ' ').trim(),
    Quantity: 1, UnitAmount: round2(amount), AccountCode: codes.bill
  }];
  if (fee > 0) lines.push({ Description: `Management fee ${Number(feePct)}%`, Quantity: 1, UnitAmount: -round2(fee), AccountCode: codes.fee });
  for (const d of deductions) {
    lines.push({
      Description: [d.description, d.supplier].filter(Boolean).join(' — ').slice(0, 4000),
      Quantity: 1, UnitAmount: -round2(d.amount), AccountCode: codes.expense
    });
  }
  return lines;
};

// Everything about one approved rent payment that the bill and the card need.
export const paymentContext = (paymentId) => db('rent_payments as p')
  .join('tenancies as t', 'p.tenancy_id', 't.id')
  .join('properties as pr', 't.property_id', 'pr.id')
  .leftJoin('users as l', 'pr.landlord_id', 'l.id')
  .leftJoin('tenants as lead', function () {
    this.on('lead.tenancy_id', '=', 't.id').andOn('lead.is_lead_tenant', '=', db.raw('1'));
  })
  .where('p.id', paymentId)
  .first(
    'p.*', 'pr.block_name', 'pr.apartment_number', 'pr.landlord_id',
    'l.name as landlord_name', 'lead.name as tenant_name'
  );

export const postLandlordBill = async (paymentId, actorId = null) => {
  const connection = await getStoredConnection();
  if (!connection || connection.status !== 'active') throw new ApiError(409, 'Xero is not connected');
  const p = await paymentContext(paymentId);
  if (!p || p.approval_status !== 'approved') throw new ApiError(409, 'Only approved rent can be sent to Xero');
  if (['posted', 'paid'].includes(p.xero_bill_status)) return { status: p.xero_bill_status, number: p.xero_bill_number, already: true };

  const billCode = await getSetting('xeroLandlordBillAccountCode', null);
  const feeCode = await getSetting('xeroFeeIncomeAccountCode', null);
  if (!billCode || !feeCode) throw new ApiError(400, 'Choose the "Landlord bills account" and "Management fee income" in Settings → Xero first');

  // A repair completed since the rent came in comes off this bill too.
  const tenancy = await db('tenancies').where('id', p.tenancy_id).first('property_id');
  await db.transaction((trx) => applyRepairDeductions(trx, tenancy?.property_id));
  const deductions = await db('rent_payment_deductions').where('rent_payment_id', p.id).orderBy('id').select('description', 'supplier', 'amount');
  const expenseCode = deductions.length ? await getSetting('xeroLandlordExpenseAccountCode', null) : null;
  if (deductions.length && !expenseCode) {
    throw new ApiError(400, 'This payment has deductions: choose the "Landlord expenses account" in Settings → Xero first');
  }

  const received = toYmd(p.received_at);
  const flat = `${String(p.block_name || '').toUpperCase()}-${p.apartment_number}`;
  const amount = round2(p.amount);
  const fee = round2(p.fee_amount || 0);
  const deducted = round2(deductions.reduce((s, d) => s + Number(d.amount), 0));
  const net = round2(amount - fee - deducted);
  const base = `PAY-${String(p.block_name || '').toUpperCase()}${pad2(p.apartment_number)}-${received.replace(/-/g, '')}`;
  let contact = await landlordContactFor(p.landlord_id, p.landlord_name);

  let bill;
  try {
    for (let attempt = 1; !bill; attempt++) {
      const { number, existing } = await chooseBillNumber(base, net.toFixed(2), contact);
      if (existing) { bill = { ...existing, InvoiceNumber: number }; break; }
      const lines = landlordBillLines(
        { flat, tenantName: p.tenant_name, receivedUk: uk(received), amount, feePct: p.fee_pct, fee },
        deductions,
        { bill: billCode, fee: feeCode, expense: expenseCode }
      );
      const r = await xero('PUT', '/Invoices', {
        searchParams: { summarizeErrors: 'false' },
        body: {
          Invoices: [{
            Type: 'ACCPAY',
            Contact: contact,
            Date: received,
            DueDate: received,
            InvoiceNumber: number,
            Reference: `${p.tenant_name || flat} ${p.xero_invoice_number || ''}`.trim().slice(0, 255),
            Status: 'AUTHORISED',
            LineAmountTypes: 'NoTax',
            LineItems: lines
          }]
        }
      });
      const created = r.body?.Invoices?.[0];
      const errors = created?.ValidationErrors?.map((e) => e.Message).filter(Boolean) || [];
      if (!r.ok || !created?.InvoiceID || errors.length) {
        const message = errors.length ? errors.join('; ') : xeroMessage(r.error);
        // The saved contact isn't in this Xero organisation: forget it and send
        // the landlord by name once (Xero uses that contact or creates it).
        if (attempt === 1 && contact.ContactID && contactNotFound(message)) {
          await db('xero_contact_links').where({ kind: 'landlord', xero_contact_id: contact.ContactID }).delete();
          logger.warn(`[XeroLandlordBills] payment ${p.id}: contact ${contact.ContactID} not in Xero, retrying by name`);
          contact = contactByName(p.landlord_name);
          continue;
        }
        throw new Error(message);
      }
      bill = created;
    }
  } catch (err) {
    const error = String(err.message || 'Xero refused the bill').slice(0, 480);
    await db('rent_payments').where('id', p.id).update({ xero_bill_status: 'failed', xero_bill_error: error });
    logger.warn(`[XeroLandlordBills] payment ${p.id}: ${error}`);
    return { status: 'failed', error };
  }

  await db.transaction(async (trx) => {
    await trx('rent_payments').where('id', p.id).update({
      xero_bill_id: bill.InvoiceID, xero_bill_number: bill.InvoiceNumber, xero_bill_status: 'posted', xero_bill_error: null
    });
    const contactId = bill.Contact?.ContactID;
    if (contactId && p.landlord_id && !(await trx('xero_contact_links').where({ xero_contact_id: contactId, kind: 'landlord' }).first())) {
      await trx('xero_contact_links').insert({ xero_contact_id: contactId, kind: 'landlord', landlord_id: p.landlord_id, created_by: actorId });
    }
    await trx('audit_log').insert({
      actor_id: actorId, actor_role: actorId ? 'ADMIN' : 'SYSTEM', action: 'XERO_LANDLORD_BILL_POSTED',
      entity_type: 'rent_payment', entity_id: p.id,
      meta: JSON.stringify({ bill: bill.InvoiceNumber, rent: amount, fee, deductions: deducted, net }), ip_address: null
    });
  });
  return { status: 'posted', number: bill.InvoiceNumber, net };
};

// Undo "Send to Xero" while the landlord has not been paid: the bill is voided.
export const voidLandlordBill = async (paymentId, actorId = null) => {
  const p = await db('rent_payments').where('id', paymentId).first();
  if (!p?.xero_bill_id || p.xero_bill_status !== 'posted') throw new ApiError(409, 'There is no unpaid Xero bill to undo for this payment');
  const r = await xero('GET', `/Invoices/${p.xero_bill_id}`);
  const bill = r.body?.Invoices?.[0];
  if (!r.ok || !bill) throw new ApiError(502, 'Could not read the bill in Xero');
  if (Number(bill.AmountPaid || 0) > 0) throw new ApiError(409, 'The landlord has already been paid against this bill in Xero');
  if (!['VOIDED', 'DELETED'].includes(bill.Status)) {
    const v = await xero('POST', `/Invoices/${p.xero_bill_id}`, { body: { Invoices: [{ InvoiceID: p.xero_bill_id, Status: 'VOIDED' }] } });
    if (!v.ok) throw new ApiError(502, `Xero did not void the bill: ${xeroMessage(v.error)}`);
  }
  await db('rent_payments').where('id', p.id).update({ xero_bill_status: 'voided' });
  await db('audit_log').insert({
    actor_id: actorId, actor_role: actorId ? 'ADMIN' : 'SYSTEM', action: 'XERO_LANDLORD_BILL_VOIDED',
    entity_type: 'rent_payment', entity_id: p.id, meta: JSON.stringify({ bill: p.xero_bill_number }), ip_address: null
  });
  return { status: 'voided', number: p.xero_bill_number };
};

// ── The rest of the split on approval ───────────────────────────────────────
// Besides the landlord bill, approving rent in Rent Cycle:
//   • bills each repair's contractor (one ACCPAY bill per repair line, coded to
//     the landlord expenses account, so it cancels the minus line on the
//     landlord bill: ROCA pays the contractor with the landlord's money);
//   • records ROCA's fee moving from the rent (client) bank account to ROCA's own
//     (a Xero bank transfer, reference "MF PH-31 …").
// Xero records them; the money is still moved in the bank. A recorded transfer
// shows as "move it in your bank" until Xero has matched both sides to real bank
// lines ("moved"). Each part is done once and retried on its own. `call` is the
// Xero client (tests pass a fake).

const contractorContactFor = async (contractor) => {
  const link = await db('xero_contact_links').where({ kind: 'contractor', contractor_id: contractor.id }).orderBy('id', 'desc').first('xero_contact_id');
  if (link) return { ContactID: link.xero_contact_id };
  return { Name: (String(contractor.company_name || '').trim() || 'Contractor').slice(0, 255), ...(contractor.email ? { EmailAddress: contractor.email } : {}) };
};

// The contractor's bill for one repair line.
export const contractorBillPayload = ({ number, contact, date, flat, description, amount, code, reference }) => ({
  Type: 'ACCPAY',
  Contact: contact,
  Date: date,
  DueDate: date,
  InvoiceNumber: number,
  Reference: String(reference || '').slice(0, 255),
  Status: 'AUTHORISED',
  LineAmountTypes: 'NoTax',
  LineItems: [{ Description: `${description} ${flat}`.trim().slice(0, 4000), Quantity: 1, UnitAmount: round2(amount), AccountCode: code }]
});

// ROCA's fee moving to ROCA's account.
export const feeTransferPayload = ({ from, to, amount, date, reference }) => ({
  FromBankAccount: { AccountID: from },
  ToBankAccount: { AccountID: to },
  Amount: round2(amount).toFixed(2),
  Date: date,
  Reference: String(reference || '').slice(0, 255)
});

const ensureConnected = async (call) => {
  if (call !== xero) return;
  const connection = await getStoredConnection();
  if (!connection || connection.status !== 'active') throw new ApiError(409, 'Xero is not connected');
};

// Bill each repair line's contractor (lines with a ticket whose ticket has a
// contractor, not billed yet or failed before). Returns one result per line.
export const postContractorBills = async (paymentId, actorId = null, call = xero) => {
  const p = await paymentContext(paymentId);
  if (!p || p.approval_status !== 'approved') throw new ApiError(409, 'Only approved rent can be sent to Xero');
  const lines = await db('rent_payment_deductions as d')
    .join('maintenance_tickets as m', 'd.ticket_id', 'm.id')
    .leftJoin('contractors as c', 'm.contractor_id', 'c.id')
    .where('d.rent_payment_id', p.id)
    .select('d.id', 'd.ticket_id', 'd.description', 'd.amount', 'd.xero_bill_status', 'd.xero_bill_number',
      'm.completed_at', 'c.id as contractor_id', 'c.company_name', 'c.email');
  if (!lines.length) return [];
  await ensureConnected(call);
  const code = await getSetting('xeroLandlordExpenseAccountCode', null);
  const flat = `${String(p.block_name || '').toUpperCase()}-${p.apartment_number}`;
  const results = [];
  for (const line of lines) {
    if (['posted', 'paid'].includes(line.xero_bill_status)) { results.push({ id: line.id, status: line.xero_bill_status, number: line.xero_bill_number, already: true }); continue; }
    if (!line.contractor_id) { results.push({ id: line.id, status: 'no_contractor' }); continue; }
    const fail = async (error) => {
      await db('rent_payment_deductions').where('id', line.id).update({ xero_bill_status: 'failed', xero_bill_error: String(error).slice(0, 480) });
      logger.warn(`[XeroContractorBills] line ${line.id}: ${error}`);
      results.push({ id: line.id, status: 'failed', error });
    };
    if (!code) { await fail('Choose the "Landlord expenses account" in Settings → Xero first'); continue; }
    const amount = round2(line.amount);
    const date = line.completed_at ? toYmd(line.completed_at) : todayYmdLocal();
    const base = `REP-${String(p.block_name || '').toUpperCase()}${pad2(p.apartment_number)}-T${line.ticket_id}`;
    let contact = await contractorContactFor({ id: line.contractor_id, company_name: line.company_name, email: line.email });
    let bill = null;
    try {
      for (let attempt = 1; !bill; attempt++) {
        const { number, existing } = await chooseNumber(base, amount.toFixed(2), contact, call, 'rent_payment_deductions');
        if (existing) { bill = { ...existing, InvoiceNumber: number }; break; }
        const r = await call('PUT', '/Invoices', {
          searchParams: { summarizeErrors: 'false' },
          body: { Invoices: [contractorBillPayload({ number, contact, date, flat, description: line.description, amount, code, reference: `${flat} ${p.xero_bill_number || ''}`.trim() })] }
        });
        const created = r.body?.Invoices?.[0];
        const errors = created?.ValidationErrors?.map((e) => e.Message).filter(Boolean) || [];
        if (!r.ok || !created?.InvoiceID || errors.length) {
          const message = errors.length ? errors.join('; ') : xeroMessage(r.error);
          if (attempt === 1 && contact.ContactID && contactNotFound(message)) {
            await db('xero_contact_links').where({ kind: 'contractor', xero_contact_id: contact.ContactID }).delete();
            contact = { Name: (String(line.company_name || '').trim() || 'Contractor').slice(0, 255), ...(line.email ? { EmailAddress: line.email } : {}) };
            continue;
          }
          throw new Error(message);
        }
        bill = created;
      }
    } catch (err) {
      await fail(err.message || 'Xero refused the contractor bill');
      continue;
    }
    await db.transaction(async (trx) => {
      await trx('rent_payment_deductions').where('id', line.id).update({
        xero_bill_id: bill.InvoiceID, xero_bill_number: bill.InvoiceNumber, xero_bill_status: 'posted', xero_bill_error: null
      });
      const contactId = bill.Contact?.ContactID;
      if (contactId && !(await trx('xero_contact_links').where({ xero_contact_id: contactId, kind: 'contractor' }).first())) {
        await trx('xero_contact_links').insert({ xero_contact_id: contactId, kind: 'contractor', contractor_id: line.contractor_id, created_by: actorId });
      }
      await trx('audit_log').insert({
        actor_id: actorId, actor_role: actorId ? 'ADMIN' : 'SYSTEM', action: 'XERO_CONTRACTOR_BILL_POSTED',
        entity_type: 'rent_payment', entity_id: p.id,
        meta: JSON.stringify({ bill: bill.InvoiceNumber, ticket: line.ticket_id, contractor: line.company_name, amount }), ip_address: null
      });
    });
    results.push({ id: line.id, status: 'posted', number: bill.InvoiceNumber, amount });
  }
  return results;
};

// Record ROCA's fee moving to ROCA's account (once per payment).
export const postFeeTransfer = async (paymentId, actorId = null, call = xero) => {
  const p = await paymentContext(paymentId);
  if (!p || p.approval_status !== 'approved') throw new ApiError(409, 'Only approved rent can be sent to Xero');
  if (['recorded', 'moved', 'done'].includes(p.fee_transfer_status)) return { status: p.fee_transfer_status, already: true };
  const fee = round2(p.fee_amount || 0);
  if (fee <= 0) return { status: 'none' };
  const from = await getSetting('xeroRentBankAccountId', null);
  const to = await getSetting('xeroFeeBankAccountId', null);
  if (!from || !to) {
    const note = 'Choose the "Rent (client) bank account" and "ROCA fee bank account" in Settings → Xero to record the fee transfer';
    await db('rent_payments').where('id', p.id).update({ fee_transfer_status: 'skipped', fee_transfer_error: note });
    return { status: 'skipped', note };
  }
  await ensureConnected(call);
  const flat = `${String(p.block_name || '').toUpperCase()}-${p.apartment_number}`;
  const payload = feeTransferPayload({ from, to, amount: fee, date: todayYmdLocal(), reference: `MF ${flat} ${p.xero_bill_number || ''}`.trim() });
  const r = await call('PUT', '/BankTransfers', { body: { BankTransfers: [payload] } });
  const made = r.body?.BankTransfers?.[0];
  const errors = made?.ValidationErrors?.map((e) => e.Message).filter(Boolean) || [];
  if (!r.ok || !made?.BankTransferID || errors.length) {
    const error = (errors.length ? errors.join('; ') : xeroMessage(r.error) || 'Xero refused the transfer').slice(0, 480);
    await db('rent_payments').where('id', p.id).update({ fee_transfer_status: 'failed', fee_transfer_error: error });
    logger.warn(`[XeroFeeTransfer] payment ${p.id}: ${error}`);
    return { status: 'failed', error };
  }
  await db.transaction(async (trx) => {
    await trx('rent_payments').where('id', p.id).update({ fee_transfer_id: made.BankTransferID, fee_transfer_status: 'recorded', fee_transfer_error: null });
    await trx('audit_log').insert({
      actor_id: actorId, actor_role: actorId ? 'ADMIN' : 'SYSTEM', action: 'XERO_FEE_TRANSFER_RECORDED',
      entity_type: 'rent_payment', entity_id: p.id, meta: JSON.stringify({ amount: fee, reference: payload.Reference }), ip_address: null
    });
  });
  return { status: 'recorded', amount: fee };
};

// Has the fee really moved? Xero says so once both sides of the transfer are
// matched to bank statement lines (reconciled).
// onlyPaymentIds limits the check (tests).
export const pullFeeTransferStatus = async (call = xero, onlyPaymentIds = null) => {
  const q = db('rent_payments').whereIn('fee_transfer_status', ['recorded', 'done']).whereNotNull('fee_transfer_id');
  if (onlyPaymentIds) q.whereIn('id', onlyPaymentIds);
  const rows = await q.select('id', 'fee_transfer_id');
  let moved = 0;
  for (const row of rows) {
    const r = await call('GET', `/BankTransfers/${row.fee_transfer_id}`);
    const bt = r.body?.BankTransfers?.[0];
    if (!r.ok || !bt) { logger.warn(`[XeroFeeTransfer] Could not read transfer ${row.fee_transfer_id}: ${xeroMessage(r.error)}`); continue; }
    if (bt.FromIsReconciled && bt.ToIsReconciled) {
      await db('rent_payments').where('id', row.id).update({ fee_transfer_status: 'moved', fee_moved_at: toYmd(new Date()) });
      moved++;
    }
  }
  return { moved };
};

// Approve → Xero: the landlord bill, the contractor bills and the fee transfer.
// One part failing doesn't stop the others; a retry redoes only what is missing.
export const sendRentSplit = async (paymentId, actorId = null) => {
  const out = { landlord: null, contractors: [], fee: null, errors: [] };
  try {
    out.landlord = await postLandlordBill(paymentId, actorId);
    if (out.landlord.status === 'failed') out.errors.push(`Landlord bill: ${out.landlord.error}`);
  } catch (err) {
    out.landlord = { status: 'failed', error: err.message };
    out.errors.push(`Landlord bill: ${err.message}`);
  }
  try {
    out.contractors = await postContractorBills(paymentId, actorId);
    for (const c of out.contractors.filter((x) => x.status === 'failed')) out.errors.push(`Contractor bill: ${c.error}`);
  } catch (err) {
    out.errors.push(`Contractor bills: ${err.message}`);
  }
  try {
    out.fee = await postFeeTransfer(paymentId, actorId);
    if (out.fee.status === 'failed') out.errors.push(`Fee transfer: ${out.fee.error}`);
  } catch (err) {
    out.fee = { status: 'failed', error: err.message };
    out.errors.push(`Fee transfer: ${err.message}`);
  }
  return out;
};

// Undo: void the contractor bills not paid yet (the landlord bill is voided by voidLandlordBill).
export const voidContractorBills = async (paymentId, actorId = null, call = xero) => {
  const lines = await db('rent_payment_deductions').where({ rent_payment_id: paymentId, xero_bill_status: 'posted' }).whereNotNull('xero_bill_id');
  let voided = 0;
  const kept = [];
  for (const line of lines) {
    const r = await call('GET', `/Invoices/${line.xero_bill_id}`);
    const bill = r.body?.Invoices?.[0];
    if (!r.ok || !bill) { kept.push(`${line.xero_bill_number} (couldn't read it in Xero)`); continue; }
    if (Number(bill.AmountPaid || 0) > 0) { kept.push(`${line.xero_bill_number} (contractor already paid)`); continue; }
    if (!['VOIDED', 'DELETED'].includes(bill.Status)) {
      const v = await call('POST', `/Invoices/${line.xero_bill_id}`, { body: { Invoices: [{ InvoiceID: line.xero_bill_id, Status: 'VOIDED' }] } });
      if (!v.ok) { kept.push(`${line.xero_bill_number} (Xero did not void it)`); continue; }
    }
    await db('rent_payment_deductions').where('id', line.id).update({ xero_bill_status: 'voided' });
    await db('audit_log').insert({
      actor_id: actorId, actor_role: actorId ? 'ADMIN' : 'SYSTEM', action: 'XERO_CONTRACTOR_BILL_VOIDED',
      entity_type: 'rent_payment', entity_id: paymentId, meta: JSON.stringify({ bill: line.xero_bill_number }), ip_address: null
    });
    voided++;
  }
  return { voided, kept };
};

// Has the contractor been paid? Read back with the landlord bills.
// onlyPaymentIds limits the check (tests).
export const pullContractorBillStatus = async (call = xero, onlyPaymentIds = null) => {
  const q = db('rent_payment_deductions').where('xero_bill_status', 'posted').whereNotNull('xero_bill_id');
  if (onlyPaymentIds) q.whereIn('rent_payment_id', onlyPaymentIds);
  const rows = await q.select('id', 'xero_bill_id');
  let paid = 0;
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    const r = await call('GET', '/Invoices', { searchParams: { IDs: chunk.map((c) => c.xero_bill_id).join(',') } });
    if (!r.ok) { logger.warn(`[XeroContractorBills] Could not read bills: ${xeroMessage(r.error)}`); continue; }
    for (const bill of r.body?.Invoices || []) {
      const row = chunk.find((c) => c.xero_bill_id === bill.InvoiceID);
      if (!row) continue;
      if (bill.Status === 'PAID') {
        const lastPayment = (bill.Payments || []).map((pm) => xeroDateYmd(pm.Date)).sort().pop();
        await db('rent_payment_deductions').where('id', row.id).update({
          xero_bill_status: 'paid', paid_at: bill.FullyPaidOnDate ? xeroDateYmd(bill.FullyPaidOnDate) : (lastPayment || toYmd(new Date()))
        });
        paid++;
      } else if (['VOIDED', 'DELETED'].includes(bill.Status)) {
        await db('rent_payment_deductions').where('id', row.id).update({ xero_bill_status: 'voided' });
      }
    }
  }
  return { paid };
};

// Has the landlord been paid? Bills sent from Roca Living are read back in the
// same sync as the rent payments (contractor bills too).
export const pullLandlordBillStatus = async () => {
  const rows = await db('rent_payments').where('xero_bill_status', 'posted').whereNotNull('xero_bill_id').select('id', 'xero_bill_id');
  let paid = 0, voided = 0;
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    const r = await xero('GET', '/Invoices', { searchParams: { IDs: chunk.map((c) => c.xero_bill_id).join(',') } });
    if (!r.ok) { logger.warn(`[XeroLandlordBills] Could not read bills: ${xeroMessage(r.error)}`); continue; }
    for (const bill of r.body?.Invoices || []) {
      const row = chunk.find((c) => c.xero_bill_id === bill.InvoiceID);
      if (!row) continue;
      if (bill.Status === 'PAID') {
        const lastPayment = (bill.Payments || []).map((pm) => xeroDateYmd(pm.Date)).sort().pop();
        await db('rent_payments').where('id', row.id).update({
          xero_bill_status: 'paid',
          landlord_paid_at: bill.FullyPaidOnDate ? xeroDateYmd(bill.FullyPaidOnDate) : (lastPayment || toYmd(new Date()))
        });
        paid++;
      } else if (['VOIDED', 'DELETED'].includes(bill.Status)) {
        await db('rent_payments').where('id', row.id).update({ xero_bill_status: 'voided' });
        voided++;
      }
    }
  }
  const contractors = await pullContractorBillStatus();
  const fees = await pullFeeTransferStatus();
  return { paid, voided, contractors_paid: contractors.paid, fees_moved: fees.moved };
};
