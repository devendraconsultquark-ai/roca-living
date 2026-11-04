// 1) Landlord contacts missing in ROCA Estates: the Landlords_APT sheet import
//    (22 Oct) had no email/phone for some owners and stored placeholders
//    (no-email+ph-XX@rocaestates.invalid, phone 0000000000). The client's older
//    sheet "Roca data - Landlord.csv" (May 2026) has them. Its phone column was
//    mangled by Excel ("+31-6-51290737" became 31-6-51290737 = -51290712); the
//    real numbers below are |value| + 25, checked against 7 numbers that were
//    already right in ROCA Estates.
//    Only a placeholder or empty value is replaced — a real value is never
//    overwritten. Roca Living's copy of a linked landlord is updated the same way.
// 2) Test tenant accounts in ROCA Estates (tenant portal): "Tenant One",
//    "Tenant" and the developer's own login, with their test leases.
//
// Run from the server folder (uses this server's .env):
//   node scripts/fix-contacts-and-test-accounts.mjs            → DRY RUN
//   node scripts/fix-contacts-and-test-accounts.mjs --apply --em-db=<rocaem db> --rl-db=<roca living db>
// Safe to run again: done items show "nothing to change". Back up both databases first.
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const mod = (rel) => import(pathToFileURL(path.join(HERE, '..', rel)).href);
const { emDb, default: db } = await mod('src/config/db.js');
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

const [[{ d: rlName }]] = await db.raw('SELECT DATABASE() AS d');
const [[{ d: emName }]] = await emDb.raw('SELECT DATABASE() AS d');
if (APPLY && (argValue('rl-db') !== rlName || argValue('em-db') !== emName)) {
  console.log(`REFUSED: connected to ${emName} (ROCA Estates) and ${rlName} (Roca Living). To apply, pass exactly --em-db=${emName} --rl-db=${rlName}`);
  await done(1);
}
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${emName} (ROCA Estates) + ${rlName} (Roca Living)\n`);

const SOURCE = 'Roca data - Landlord.csv (client, May 2026)';
// name = ROCA Estates main owner name (must match exactly, so nothing lands on the wrong person)
const CONTACTS = [
  { name: 'Malitholo Ltd', set: { phone: '+31 6 51290737' }, note: 'Marc Hogeboom, director (PH-31, PH-37)' },
  { name: 'Christoffel Nicolaas Deen', set: { email: 'christoffeldeen@me.com', phone: '+31 6 22124722', address: 'Ruysdaelkade 51 hs', city: 'Amsterdam', postcode: '1072 AJ', country: 'Netherlands' } },
  { name: 'Rick Christiaan Arnoldus van der Hart', set: { email: 'dreadlock1ri@hotmail.com', phone: '+31 6 48386569', address: 'Driedistelstraat 15', city: 'Amsterdam', postcode: '1031 JT', country: 'Netherlands' } },
  { name: 'Mark Andre Schubert', set: { email: 'mark.andre.schubert@gmail.com', phone: '+31 6 31927924', address: 'Lien Gisolfstraat 8', city: 'Haarlem', postcode: '2031 VS', country: 'Netherlands' } },
  { name: 'Stef van Eysendeyk', set: { email: 'stef-van-eysendeyk@hotmail.com', phone: '+32 494 28 40 81' } },
];
const TEST_TENANTS = [
  { full_name: 'Tenant One', email: 'tenant@gmail.com' },
  { full_name: 'Tenant', email: 'tenat@gmail.com' },
  { full_name: 'devendra choudhary', email: 'devendra.consultquark@gmail.com' },
];

const isPlaceholder = (k, v) => v === null || v === undefined || String(v).trim() === ''
  || (k === 'email' && /\.invalid$/i.test(String(v))) || (k === 'phone' && /^0+$/.test(String(v).trim()));

// ── 1. Landlord contacts ─────────────────────────────────────────────────────
const plans = [];
console.log('Landlord contacts (ROCA Estates):');
for (const c of CONTACTS) {
  const u = await emDb('users').where({ role: 'LANDLORD', name: c.name }).first();
  if (!u) { console.log(`  REFUSED  ${c.name}: no ROCA Estates landlord with exactly this name — not changed`); continue; }
  const changes = Object.entries(c.set).filter(([k, v]) => isPlaceholder(k, u[k]) && String(u[k] ?? '') !== v).map(([k, v]) => ({ k, from: u[k], to: v }));
  const kept = Object.entries(c.set).filter(([k, v]) => !isPlaceholder(k, u[k]) && String(u[k]) !== v);
  if (!changes.length) { console.log(`  #${u.id} ${c.name}: nothing to change`); }
  for (const ch of changes) console.log(`  #${u.id} ${c.name}: ${ch.k} ${ch.from ?? '—'} → ${ch.to}`);
  for (const [k, v] of kept) console.log(`  #${u.id} ${c.name}: ${k} kept as ${u[k]} (sheet says ${v})`);
  const rl = await db('users').where({ role: 'LANDLORD', rocaem_user_id: u.id }).first();
  const rlChanges = rl ? ['email', 'phone'].filter((k) => c.set[k] && isPlaceholder(k, rl[k]) && rl[k] !== c.set[k]).map((k) => ({ k, from: rl[k], to: c.set[k] })) : [];
  for (const ch of rlChanges) console.log(`      Roca Living landlord #${rl.id}: ${ch.k} ${ch.from || '—'} → ${ch.to}`);
  if (changes.length || rlChanges.length) plans.push({ c, u, changes, rl, rlChanges });
}

// ── 2. Test tenant accounts ──────────────────────────────────────────────────
console.log('\nTest tenant accounts (ROCA Estates tenant portal):');
const tests = [];
for (const t of TEST_TENANTS) {
  const row = await emDb('tenant_users').where({ email: t.email, full_name: t.full_name }).first('id', 'full_name', 'email', 'created_at');
  if (!row) { console.log(`  ${t.full_name} (${t.email}): not found — nothing to do`); continue; }
  const leases = Number((await emDb('tenant_leases').where('tenant_id', row.id).count('* as c').first()).c);
  const complaints = Number((await emDb('complaints').where('tenant_id', row.id).count('* as c').first()).c);
  console.log(`  DELETE  #${row.id} ${row.full_name} (${row.email}) + ${leases} lease(s)${complaints ? ` + ${complaints} complaint(s)` : ''}`);
  tests.push(row);
}

if (!plans.length && !tests.length) { console.log('\nNothing to change.'); await done(0); }
if (!APPLY) { console.log(`\nDRY RUN — nothing changed. To do it: add --apply --em-db=${emName} --rl-db=${rlName}`); await done(0); }

for (const { c, u, changes, rl, rlChanges } of plans) {
  if (changes.length) {
    await emDb.transaction(async (trx) => {
      await trx('users').where('id', u.id).update(Object.fromEntries(changes.map((x) => [x.k, x.to])));
      await trx('change_log').insert({ entity_type: 'landlord', entity_id: u.id, entity_label: c.name.slice(0, 255), action: 'update', fields: JSON.stringify(changes.map((x) => x.k)), user_name: `Contact fix (${SOURCE})` });
    });
  }
  if (rlChanges.length) {
    const admin = await db('users').where('role', 'ADMIN').orderBy('id').first();
    await db.transaction(async (trx) => {
      await trx('users').where('id', rl.id).update(Object.fromEntries(rlChanges.map((x) => [x.k, x.to])));
      await trx('audit_log').insert({ actor_id: admin.id, actor_role: 'ADMIN', action: 'LANDLORD_CONTACT_FIXED', entity_type: 'landlord', entity_id: rl.id, meta: JSON.stringify({ fields: rlChanges.map((x) => x.k), source: SOURCE, by: 'fix-contacts-and-test-accounts.mjs' }), ip_address: null });
    });
  }
  console.log(`updated: ${c.name}`);
}
for (const row of tests) {
  await emDb.transaction(async (trx) => {
    await trx('tenant_leases').where('tenant_id', row.id).delete();
    await trx('tenant_users').where('id', row.id).delete();
    await trx('change_log').insert({ entity_type: 'tenant', entity_id: row.id, entity_label: row.full_name, action: 'delete', fields: null, user_name: 'Test account removal (script)' });
  });
  console.log(`deleted test account: ${row.full_name}`);
}
console.log('\nDone. Run it again (without --apply): everything should show "nothing to change" / "not found".');
await done(0);
