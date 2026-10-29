// Remove what an earlier Xero organisation left in Roca Living. Live was on the
// dummy "Rocaliving" org (13–23 Oct 2026), then disconnected and connected to
// the real one; a disconnect didn't clear the old ids, so its contact links,
// rent invoice rows, the test payments made from them and its bank lines stayed.
// Everything Xero-related saved before the current connection was made belongs
// to the old organisation. Nothing is sent to Xero. Run from the server folder,
// so it uses this server's .env:
//
//   node scripts/xero-clear-old-org.mjs
//       → DRY RUN (default): lists what would go, writes nothing
//   node scripts/xero-clear-old-org.mjs --apply --rl-db=<roca living db>
//       → does it. The name must match the database this .env connects to.
//
// An approved-rent (AR-) statement made only from that test money is deleted if
// it is a draft; an issued one is refused unless named: --delete-ar=AR-PH_36_0001.
// Refused (nothing changed) if any of that money is on a landlord statement, or
// on an AR- statement that also holds other money. Back the database up first.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const DELETE_AR = (argValue('delete-ar') || '').split(',').map((x) => x.trim()).filter(Boolean);
const mod = (rel) => import(pathToFileURL(path.join(HERE, '..', rel)).href);
const { emDb, default: db } = await mod('src/config/db.js');
const { allocateTenancyPayments } = await mod('src/utils/rentAllocation.js');
const { toYmd } = await mod('src/utils/dateHelpers.js');
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

const [[{ d: rlName }]] = await db.raw('SELECT DATABASE() AS d');
if (APPLY && argValue('rl-db') !== rlName) {
  console.log(`REFUSED: connected to ${rlName}. To apply, pass exactly --rl-db=${rlName}`);
  await done(1);
}
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${rlName} (Roca Living)\n`);

const connection = await db('xero_connections').where('status', 'active').orderBy('id', 'desc').first('id', 'tenant_name', 'created_at');
if (!connection) { console.log('No active Xero connection — nothing to compare against.'); await done(1); }
const cutoff = connection.created_at;
const when = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : '—');
const money = (n) => `£${Number(n).toFixed(2)}`;
const uk = (d) => (d ? toYmd(d).split('-').reverse().join('/') : '—');
const or0 = (a) => (a.length ? a : [0]);
console.log(`Current Xero organisation: "${connection.tenant_name}", connected ${when(cutoff)} UTC.`);
console.log('Everything below was saved before that, i.e. for an earlier organisation.\n');

const flatOf = async (tenancyId) => {
  const r = await db('tenancies as t').join('properties as p', 't.property_id', 'p.id').where('t.id', tenancyId).first('p.block_name', 'p.apartment_number');
  return r ? `${String(r.block_name || '').toUpperCase()}-${r.apartment_number}` : `tenancy #${tenancyId}`;
};

// ── What the old organisation left ───────────────────────────────────────────
const links = await db('xero_contact_links').where('created_at', '<', cutoff).orderBy('id');
const invoices = await db('xero_rent_invoices').where('created_at', '<', cutoff).orderBy('id');
const invoiceNumbers = invoices.map((i) => i.invoice_number);
const invoicePayments = invoiceNumbers.length
  ? await db('rent_payments').whereIn('xero_invoice_number', invoiceNumbers).whereNotNull('xero_payment_id').orderBy('id') : [];
const bankLines = await db('xero_bank_transactions').where('created_at', '<', cutoff).orderBy('id');
const bankPaymentIds = bankLines.filter((b) => b.rent_payment_id && b.reconciled_as === 'tenant_rent' && !(b.link_meta && JSON.parse(b.link_meta)?.matched_existing === true)).map((b) => b.rent_payment_id);
const bankPayments = bankPaymentIds.length ? await db('rent_payments').whereIn('id', bankPaymentIds) : [];
const accounts = await db('xero_import_accounts').where('created_at', '<', cutoff);

// Money already on a landlord statement can't be taken back here. An AR-
// statement made only from this money goes with it (drafts; issued ones by name).
const refused = [];
const removing = [...invoicePayments.filter((x) => !x.xero_linked_existing), ...bankPayments];
const removingIds = new Set(removing.map((p) => p.id));
const arStatements = [];
for (const p of removing) {
  const st = await db('rent_payment_allocations as a').join('landlord_statements as s', 'a.statement_id', 's.id').where('a.payment_id', p.id).first('s.statement_number');
  if (st) refused.push(`payment #${p.id} ${money(p.amount)} is on statement ${st.statement_number}`);
}
for (const arId of new Set([...invoicePayments, ...bankPayments].map((p) => p.approved_statement_id).filter(Boolean))) {
  const ar = await db('approved_rent_statements').where('id', arId).first('id', 'statement_number', 'status', 'document_id', 'created_at');
  const others = (await db('rent_payments').where('approved_statement_id', arId).pluck('id')).filter((id) => !removingIds.has(id));
  if (others.length) refused.push(`${ar.statement_number} also holds other payments (#${others.join(', #')})`);
  else if (ar.status !== 'draft' && !DELETE_AR.includes(ar.statement_number)) refused.push(`${ar.statement_number} was issued (made ${when(ar.created_at)}) — if it was only a test, run with --delete-ar=${ar.statement_number}`);
  else arStatements.push(ar);
}
const statementsPaidByLines = bankLines.filter((b) => b.reconciled_as === 'landlord_payout');

// ── Report ───────────────────────────────────────────────────────────────────
const out = [];
out.push(`Xero contact links: ${links.length}`);
for (const l of links) out.push(`  #${l.id} ${l.kind}${l.landlord_id ? ` landlord #${l.landlord_id}` : ''}${l.tenancy_id ? ` ${await flatOf(l.tenancy_id)}` : ''} (${when(l.created_at)})`);
out.push(`Rent invoice records: ${invoices.length}`);
for (const i of invoices) out.push(`  ${i.invoice_number} ${await flatOf(i.tenancy_id)} ${money(i.amount)} due ${uk(i.due_date)}, ${i.status} (${when(i.created_at)})`);
out.push(`Payments recorded from those invoices: ${invoicePayments.length}`);
for (const p of invoicePayments) {
  out.push(`  #${p.id} ${await flatOf(p.tenancy_id)} ${money(p.amount)} received ${uk(p.received_at)} on ${p.xero_invoice_number}`
    + `${p.xero_bill_number ? `, landlord bill ${p.xero_bill_number} (${p.xero_bill_status})` : ''}`
    + `${p.xero_linked_existing ? ' — typed in by hand: kept, only its Xero link is cleared' : ' — removed'}`);
}
out.push(`Bank lines imported: ${bankLines.length}${bankLines.length ? ` (${bankLines.filter((b) => b.status === 'reconciled').length} reconciled)` : ''}`);
for (const b of bankLines.filter((x) => x.status === 'reconciled')) out.push(`  #${b.id} ${money(b.amount)} ${uk(b.date)} reconciled as ${b.reconciled_as}`);
for (const p of bankPayments) out.push(`  payment #${p.id} ${await flatOf(p.tenancy_id)} ${money(p.amount)} received ${uk(p.received_at)} (made from a bank line) — removed`);
if (statementsPaidByLines.length) out.push(`  ${statementsPaidByLines.length} line(s) marked statements as paid — those statements go back to their status before`);
for (const ar of arStatements) out.push(`Approved-rent statement ${ar.statement_number} (${ar.status}, made only from that test money) — deleted`);
out.push(`Bank accounts ticked for import: ${accounts.length}`);
console.log(out.join('\n'));

if (refused.length) {
  console.log('\nREFUSED — nothing will be changed:');
  for (const r of refused) console.log('  ' + r);
  await done(1);
}
if (!links.length && !invoices.length && !bankLines.length && !accounts.length) { console.log('\nNothing to clear.'); await done(0); }
if (!APPLY) {
  console.log(`\nDRY RUN — nothing changed. To do it: add --apply --rl-db=${rlName}`);
  await done(0);
}

// ── Apply ────────────────────────────────────────────────────────────────────
const admin = await db('users').where('role', 'ADMIN').orderBy('id').first('id');
const tenancies = new Set();
const files = [];
await db.transaction(async (trx) => {
  for (const ar of arStatements) {
    const doc = ar.document_id ? await trx('documents').where('id', ar.document_id).first('id', 'file_path') : null;
    await trx('rent_payments').where('approved_statement_id', ar.id).update({ approved_statement_id: null });
    await trx('approved_rent_statements').where('id', ar.id).delete();
    if (doc) { await trx('documents').where('id', doc.id).delete(); files.push(doc.file_path); }
  }
  for (const p of invoicePayments) {
    tenancies.add(p.tenancy_id);
    if (p.xero_linked_existing) {
      await trx('rent_payments').where('id', p.id).update({
        xero_payment_id: null, xero_invoice_number: null, xero_linked_existing: false,
        fee_pct: null, fee_amount: null, net_amount: null, approval_status: null, approved_by: null, approved_at: null, split_note: null,
        xero_bill_id: null, xero_bill_number: null, xero_bill_status: null, xero_bill_error: null, landlord_paid_at: null,
      });
      continue;
    }
    await trx('transactions').where('tenancy_id', p.tenancy_id).where('description', 'like', `%(payment ${p.xero_payment_id})%`).delete();
    await trx('rent_payment_deductions').where('rent_payment_id', p.id).delete();
    await trx('rent_payment_allocations').where('payment_id', p.id).delete();
    await trx('rent_payments').where('id', p.id).delete();
  }
  for (const b of bankLines) {
    if (b.status === 'reconciled' && b.reconciled_as === 'landlord_payout') {
      for (const s of (b.link_meta ? JSON.parse(b.link_meta) : [])) await trx('landlord_statements').where('id', s.id).update({ status: s.prev_status || 'sent', paid_at: null });
    }
    const matchedExisting = b.link_meta && JSON.parse(b.link_meta)?.matched_existing === true;
    if (b.ledger_transaction_id && !matchedExisting) await trx('transactions').where('id', b.ledger_transaction_id).delete();
  }
  for (const p of bankPayments) {
    tenancies.add(p.tenancy_id);
    await trx('rent_payment_deductions').where('rent_payment_id', p.id).delete();
    await trx('rent_payment_allocations').where('payment_id', p.id).delete();
    await trx('rent_payments').where('id', p.id).delete();
  }
  await trx('xero_bank_transactions').whereIn('id', or0(bankLines.map((b) => b.id))).delete();
  await trx('xero_rent_invoices').whereIn('id', or0(invoices.map((i) => i.id))).delete();
  await trx('xero_contact_links').whereIn('id', or0(links.map((l) => l.id))).delete();
  await trx('xero_import_accounts').whereIn('id', or0(accounts.map((a) => a.id))).delete();
  for (const tid of tenancies) await allocateTenancyPayments(trx, tid);
  await trx('audit_log').insert({
    actor_id: admin?.id || null, actor_role: 'ADMIN', action: 'XERO_OLD_ORG_CLEARED', entity_type: 'xero_connection', entity_id: connection.id,
    meta: JSON.stringify({
      before: cutoff, links: links.length, invoices: invoiceNumbers, payments: [...invoicePayments, ...bankPayments].map((p) => p.id),
      bank_lines: bankLines.length, accounts: accounts.length, approved_statements: arStatements.map((a) => a.statement_number), source: 'xero-clear-old-org script',
    }),
  });
});
for (const f of files) {
  try { fs.unlinkSync(path.isAbsolute(f) ? f : path.join(process.cwd(), f)); } catch { /* already gone */ }
}
console.log('\nCleared. Run it again (without --apply): it should say "Nothing to clear."');
await done(0);
