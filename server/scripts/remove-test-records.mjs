// Remove test records from Roca Living: whole properties (with everything on
// them) and/or single tenancies (the flat itself stays). Run from the server
// folder, so it uses this server's .env:
//
//   node scripts/remove-test-records.mjs --property=1,2,3 --tenancy=9
//       → DRY RUN (default): shows what would be deleted, writes nothing
//   node scripts/remove-test-records.mjs --property=1,2,3 --tenancy=9 --apply --rl-db=<roca living db>
//       → does it. The name must match the database this .env connects to.
//
// Refused for anything a landlord statement or fee invoice was made from, and
// for properties linked to ROCA Estates (delete those from the property page).
// Back the database up first (mysqldump).
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const ids = (name) => (argValue(name) || '').split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0);
const PROPERTY_IDS = ids('property');
const TENANCY_IDS = ids('tenancy');
if (!PROPERTY_IDS.length && !TENANCY_IDS.length) {
  console.log('Usage: node scripts/remove-test-records.mjs [--property=1,2] [--tenancy=9] [--apply --rl-db=<name>]');
  process.exit(1);
}
const { emDb, default: db } = await import(pathToFileURL(path.join(HERE, '../src/config/db.js')).href);
const { deletePropertyInternal } = await import(pathToFileURL(path.join(HERE, '../src/controllers/propertyController.js')).href);
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

const [[{ d: rlName }]] = await db.raw('SELECT DATABASE() AS d');
if (APPLY && argValue('rl-db') !== rlName) {
  console.log(`REFUSED: connected to ${rlName}. To apply, pass exactly --rl-db=${rlName}`);
  await done(1);
}
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${rlName} (Roca Living)\n`);

const ymd = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : (d ? String(d).slice(0, 10) : '—'));
const count = async (q) => Number((await q.clone().count('* as n').first()).n);
const or0 = (a) => (a.length ? a : [0]);
const refused = [];

// Everything hanging off one tenancy, as [label, query builder] pairs.
const tenancyParts = async (k, tid) => {
  const payIds = await k('rent_payments').where('tenancy_id', tid).pluck('id');
  const schedIds = await k('rent_schedules').where('tenancy_id', tid).pluck('id');
  const approvedDocs = await k('approved_rent_statements').where('tenancy_id', tid).whereNotNull('document_id').pluck('document_id');
  return {
    payIds, schedIds, approvedDocs,
    deletes: [
      ['payment deductions', k('rent_payment_deductions').whereIn('rent_payment_id', or0(payIds))],
      ['payment allocations', k('rent_payment_allocations').where((w) => w.whereIn('payment_id', or0(payIds)).orWhereIn('schedule_id', or0(schedIds)))],
      ['approved rent statements', k('approved_rent_statements').where('tenancy_id', tid)],
      ['Xero rent invoices (records only)', k('xero_rent_invoices').where('tenancy_id', tid)],
      ['Xero contact links', k('xero_contact_links').where('tenancy_id', tid)],
      ['tenants', k('tenants').where('tenancy_id', tid)],
      ['deposits', k('deposits').where('tenancy_id', tid)],
      ['rent payments', k('rent_payments').where('tenancy_id', tid)],
      ['rent months', k('rent_schedules').where('tenancy_id', tid)],
      ['fire safety sign-offs', k('fire_safety_signoffs').where('tenancy_id', tid)],
      ['transactions', k('transactions').where('tenancy_id', tid)],
      ['tenancy documents', k('documents').where({ owner_type: 'tenancy', owner_id: tid })],
      ['tenancy folders', k('folders').where({ owner_type: 'tenancy', owner_id: tid })],
    ],
    unlinks: [
      ['Xero bank lines', k('xero_bank_transactions').where('tenancy_id', tid)],
      ['inspections', k('inspections').where('tenancy_id', tid)],
      ['maintenance tickets', k('maintenance_tickets').where('tenancy_id', tid)],
      ['utilities', k('utilities').where('tenancy_id', tid)],
    ],
  };
};

const removeFile = (rel) => {
  if (!rel) return;
  const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  if (fs.existsSync(abs)) { try { fs.unlinkSync(abs); } catch (e) { console.log(`  could not delete file ${abs}: ${e.message}`); } }
};

const deleteTenancy = async (trx, tid) => {
  const parts = await tenancyParts(trx, tid);
  for (const doc of await trx('documents').where({ owner_type: 'tenancy', owner_id: tid })) removeFile(doc.file_path);
  for (const [, q] of parts.deletes) await q.delete();
  for (const doc of await trx('documents').whereIn('id', or0(parts.approvedDocs))) removeFile(doc.file_path);
  await trx('documents').whereIn('id', or0(parts.approvedDocs)).delete();
  for (const [, q] of parts.unlinks) await q.update({ tenancy_id: null });
  await trx('tenancies').where('id', tid).delete();
};

// ── Plan ─────────────────────────────────────────────────────────────────────
const report = [];
const describe = async (tid, indent = '  ') => {
  const t = await db('tenancies').where('id', tid).first();
  const lead = await db('tenants').where({ tenancy_id: tid }).orderBy('is_lead_tenant', 'desc').first('name');
  const parts = await tenancyParts(db, tid);
  report.push(`${indent}tenancy #${tid} (${t.status}, from ${ymd(t.start_date)}, £${t.rent_pcm}, tenant ${lead?.name || '—'})`);
  for (const [label, q] of parts.deletes) { const n = await count(q); if (n) report.push(`${indent}  delete ${String(n).padStart(3)} ${label}`); }
  for (const [label, q] of parts.unlinks) { const n = await count(q); if (n) report.push(`${indent}  unlink ${String(n).padStart(3)} ${label} (kept, no longer tied to this tenancy)`); }
};

for (const tid of TENANCY_IDS) {
  const t = await db('tenancies').where('id', tid).first();
  if (!t) { refused.push(`tenancy #${tid}: not found`); continue; }
  const st = await count(db('landlord_statements').where('tenancy_id', tid));
  if (st) { refused.push(`tenancy #${tid}: ${st} landlord statement(s) were made from it`); continue; }
  const p = await db('properties').where('id', t.property_id).first('id', 'name');
  report.push(`TENANCY #${tid} on property #${p.id} ${p.name} (the property stays)`);
  await describe(tid);
}

for (const pid of PROPERTY_IDS) {
  const p = await db('properties').where('id', pid).first();
  if (!p) { refused.push(`property #${pid}: not found`); continue; }
  if (p.rocaem_property_id) { refused.push(`property #${pid} ${p.name}: linked to ROCA Estates #${p.rocaem_property_id} — delete it from its property page instead`); continue; }
  const tids = await db('tenancies').where('property_id', pid).pluck('id');
  const st = await count(db('landlord_statements').whereIn('tenancy_id', or0(tids)));
  const inv = await count(db('invoices').where('property_id', pid));
  if (st || inv) { refused.push(`property #${pid} ${p.name}: ${st} statement(s), ${inv} invoice(s) were made from it`); continue; }
  report.push(`PROPERTY #${pid} "${p.name}" / ${p.address_line1}, landlord user #${p.landlord_id}, ${tids.length} tenanc${tids.length === 1 ? 'y' : 'ies'}`);
  for (const tid of tids) await describe(tid, '    ');
  for (const [label, q] of [
    ['compliance rows', db('compliance_checklist').where({ scope: 'property', entity_id: pid })],
    ['certificates', db('property_certificates').where('property_id', pid)],
    ['expenses', db('property_expenses').where('property_id', pid)],
    ['documents', db('documents').where({ owner_type: 'property', owner_id: pid })],
    ['images', db('property_images').where('property_id', pid)],
    ['maintenance tickets', db('maintenance_tickets').where('property_id', pid)],
    ['inspections', db('inspections').where('property_id', pid)],
    ['utilities', db('utilities').where('property_id', pid)],
  ]) { const n = await count(q); if (n) report.push(`    delete ${String(n).padStart(3)} ${label}`); }
}

console.log(report.join('\n') || 'Nothing to delete.');
if (refused.length) { console.log('\nREFUSED (left as they are):'); for (const r of refused) console.log('  ' + r); }
const okTenancies = TENANCY_IDS.filter((tid) => !refused.some((r) => r.startsWith(`tenancy #${tid}:`)));
const okProperties = PROPERTY_IDS.filter((pid) => !refused.some((r) => r.startsWith(`property #${pid} `) || r.startsWith(`property #${pid}:`)));
if (!okTenancies.length && !okProperties.length) await done(refused.length ? 1 : 0);
if (!APPLY) {
  console.log(`\nDRY RUN — nothing deleted. To do it: add --apply --rl-db=${rlName}`);
  await done(0);
}

// ── Apply ────────────────────────────────────────────────────────────────────
const admin = await db('users').where('role', 'ADMIN').orderBy('id').first('id');
await db.transaction(async (trx) => {
  for (const tid of okTenancies) {
    const t = await trx('tenancies').where('id', tid).first();
    await deleteTenancy(trx, tid);
    // The flat is free again unless another tenancy is current on it.
    const current = await trx('tenancies').where('property_id', t.property_id).whereIn('status', ['active', 'notice', 'pending']).first('id');
    if (!current) await trx('properties').where('id', t.property_id).update({ status: 'vacant' });
    await trx('audit_log').insert({ actor_id: admin?.id || null, actor_role: 'ADMIN', action: 'TEST_TENANCY_REMOVED', entity_type: 'tenancy', entity_id: tid, meta: JSON.stringify({ property_id: t.property_id, source: 'remove-test-records script' }) });
  }
  for (const pid of okProperties) {
    const p = await trx('properties').where('id', pid).first();
    for (const tid of await trx('tenancies').where('property_id', pid).pluck('id')) await deleteTenancy(trx, tid);
    await trx('property_expenses').where('property_id', pid).delete();
    await trx('approved_rent_statements').where('property_id', pid).delete();
    await trx('xero_bank_transactions').where('property_id', pid).update({ property_id: null });
    await deletePropertyInternal(trx, pid);
    await trx('audit_log').insert({ actor_id: admin?.id || null, actor_role: 'ADMIN', action: 'TEST_PROPERTY_REMOVED', entity_type: 'property', entity_id: pid, meta: JSON.stringify({ name: p.name, source: 'remove-test-records script' }) });
  }
});
console.log(`\nDeleted ${okTenancies.length} tenanc${okTenancies.length === 1 ? 'y' : 'ies'} and ${okProperties.length} propert${okProperties.length === 1 ? 'y' : 'ies'}.`);
await done(0);
