// Fill the current Parsons House tenants' email and phone in Roca Living from
// the client's documents (Dropbox, 4 Nov 2026). Only empty fields are filled;
// a value already stored is never changed. Tenant matched by flat + name.
//
//   node scripts/fill-tenant-contacts.mjs                         → DRY RUN
//   node scripts/fill-tenant-contacts.mjs --apply --rl-db=<roca living db>
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const mod = (rel) => import(pathToFileURL(path.join(HERE, '..', rel)).href);
const { emDb, default: db } = await mod('src/config/db.js');
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

const [[{ d: rlName }]] = await db.raw('SELECT DATABASE() AS d');
if (APPLY && argValue('rl-db') !== rlName) { console.log(`REFUSED: connected to ${rlName}. To apply, pass exactly --rl-db=${rlName}`); await done(1); }
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${rlName} (Roca Living)\n`);

const TENANTS = [
  { apt: '8', name: 'Kian Wagstaff', email: 'mrkian.wag8@gmail.com', phone: '07707 355034', source: "Opulent deposit transfer sheet (his Apt 3 tenancy)" },
  { apt: '13', name: 'Muhammad Babar Mahmood', email: 'mbabaarch541@gmail.com', phone: '07383 392226', source: '13 Parsons Tenancy (agreement)' },
  { apt: '19', name: 'Gladys Bouna', email: 'mbgladys@yahoo.fr', phone: '07835 912249', source: 'Tenancy 19 Parsons (agreement)' },
  { apt: '31', name: 'Ewa Szewczyk', email: 'eva.sz@hotmail.co.uk', phone: '07950 189799', source: 'Tenancy 31 Parsons (agreement)' },
  { apt: '33', name: 'Joshua Harrison North', email: 'joshua.harrison-north@talktalk.net', phone: '07806 695020', source: 'APT 33 Parsons Tenancy Agreement' },
  { apt: '36', name: 'Dhriti Kuchi', email: 'dhriti.k@gmail.com', phone: null, source: 'Tenancy Agreement 36 Parsons House (notices clause; no phone given)' },
];

const plans = [];
for (const t of TENANTS) {
  const rows = await db('tenants as tn').join('tenancies as tc', 'tn.tenancy_id', 'tc.id').join('properties as p', 'tc.property_id', 'p.id')
    .whereIn('tc.status', ['active', 'notice', 'pending']).where('p.block_name', 'PH').where('p.apartment_number', t.apt)
    .select('tn.id', 'tn.name', 'tn.email', 'tn.phone');
  const x = rows.find((r) => String(r.name).toLowerCase().includes(t.name.toLowerCase()));
  if (!x) { console.log(`REFUSED  PH-${t.apt} ${t.name}: no current tenant with this name — not changed`); continue; }
  const set = {};
  if (t.email && !String(x.email || '').trim()) set.email = t.email;
  if (t.phone && !String(x.phone || '').trim()) set.phone = t.phone;
  if (!Object.keys(set).length) { console.log(`PH-${t.apt} ${x.name}: nothing to change`); continue; }
  console.log(`PH-${t.apt} ${x.name}: ${Object.entries(set).map(([k, v]) => `${k} → ${v}`).join(', ')}   (${t.source})`);
  plans.push({ x, set, t });
}
if (!plans.length) { console.log('\nNothing to change.'); await done(0); }
if (!APPLY) { console.log(`\nDRY RUN — nothing changed. To do it: add --apply --rl-db=${rlName}`); await done(0); }
const admin = await db('users').where('role', 'ADMIN').orderBy('id').first();
for (const { x, set, t } of plans) {
  await db.transaction(async (trx) => {
    await trx('tenants').where('id', x.id).update(set);
    await trx('audit_log').insert({ actor_id: admin.id, actor_role: 'ADMIN', action: 'TENANT_CONTACT_FILLED', entity_type: 'tenant', entity_id: x.id, meta: JSON.stringify({ fields: Object.keys(set), source: t.source, by: 'fill-tenant-contacts.mjs' }), ip_address: null });
  });
  console.log(`updated: PH-${t.apt} ${x.name}`);
}
await done(0);
