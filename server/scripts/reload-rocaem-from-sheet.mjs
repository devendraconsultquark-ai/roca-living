// Reload ROCA Estates (Rocaem) landlords and Parsons House flats from Satish's
// sheet ("PH_tenant - Tenant Due Date" exported as CSV), then re-link Roca
// Living to the new ROCA Estates ids. Run from the server folder, so it uses
// this server's .env (ROCAEM_DB_* and DB_*):
//
//   node scripts/reload-rocaem-from-sheet.mjs "<sheet.csv>"
//       → DRY RUN (default): prints what it would delete / create / re-link, writes nothing
//   node scripts/reload-rocaem-from-sheet.mjs "<sheet.csv>" --apply --em-db=<rocaem db> --rl-db=<roca living db>
//       → does it. Both names must match the databases this .env connects to.
//
// ROCA Estates: deletes ALL landlords and flats (and their invoices, leases,
// tasks, documents…) and creates them from the sheet. Only for a ROCA Estates
// database holding test/old data. Back it up first (mysqldump).
// Roca Living: only re-links properties.rocaem_property_id / users.rocaem_user_id;
// nothing there is deleted.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHEET = process.argv.slice(2).find((a) => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
if (!SHEET || !fs.existsSync(SHEET)) {
  console.log('Usage: node scripts/reload-rocaem-from-sheet.mjs "<sheet.csv>" [--apply --em-db=<name> --rl-db=<name>]');
  process.exit(1);
}
const { emDb, default: rlDb } = await import(pathToFileURL(path.join(HERE, '../src/config/db.js')).href);

const [[{ d: emName }]] = await emDb.raw('SELECT DATABASE() AS d');
const [[{ d: rlName }]] = await rlDb.raw('SELECT DATABASE() AS d');
if (APPLY && (argValue('em-db') !== emName || argValue('rl-db') !== rlName)) {
  console.log(`REFUSED: connected to ${emName} (ROCA Estates) / ${rlName} (Roca Living). To apply, pass exactly --em-db=${emName} --rl-db=${rlName}`);
  await emDb.destroy(); await rlDb.destroy();
  process.exit(1);
}
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${emName} (ROCA Estates) + ${rlName} (Roca Living)\n`);

// ── Sheet ────────────────────────────────────────────────────────────────────
const parseCsv = (text) => {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
};
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const PARTICLES = new Set(['van', 'der', 'de', 'den', 'la', 'le', 'du', 'von']);
const KEEP_UPPER = new Set(['JTLH', 'GKP', 'UK']);
const wordCase = (w, i) => {
  const lw = w.toLowerCase();
  if (KEEP_UPPER.has(w.toUpperCase())) return w.toUpperCase();
  if (lw === 'ltd') return 'Ltd';
  if (i > 0 && PARTICLES.has(lw)) return lw;
  return lw.charAt(0).toUpperCase() + lw.slice(1);
};
// ALL CAPS → normal case; mixed case kept, only each word's first letter raised
// (particles stay lowercase): "Johan willem Leupen" → "Johan Willem Leupen".
const niceName = (s) => {
  const v = clean(s);
  const allCaps = v === v.toUpperCase();
  return v.split(' ').map((w, i) => {
    if (allCaps) return wordCase(w, i);
    if (i > 0 && PARTICLES.has(w.toLowerCase())) return w.toLowerCase();
    return KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
};
const isCompany = (s) => /\b(LTD|LIMITED)\b/i.test(s) || /^JTLH$/i.test(clean(s));

const parseOwner = (raw) => {
  let text = clean(raw);
  let email = null;
  const m = text.match(/\(\s*([^\s@()]+@[^\s@()]+\.[^\s()]+)\s*\)/);
  if (m) { email = m[1].toLowerCase(); text = clean(text.replace(m[0], '')); }
  if (!text) return null;
  if (isCompany(text)) return { company: true, name: niceName(text), joint: null, email };
  const [main, ...rest] = text.split(/\s+(?:AND|&)\s+/i);
  return { company: false, name: niceName(main), joint: rest.length ? niceName(rest.join(' & ')) : null, email };
};

const rows = parseCsv(fs.readFileSync(SHEET, 'utf8'));
const flats = new Map(); // n → { n, ownerRaw }
for (const r of rows) {
  const m = clean(r[0]).match(/^APT\s*(\d+)$/i);
  if (!m) continue;
  const n = Number(m[1]);
  const ownerRaw = clean(r[2]);
  // Repeated flats (tenant history: APT 8, APT 19) keep the last non-empty owner.
  const prev = flats.get(n);
  flats.set(n, { n, ownerRaw: ownerRaw || prev?.ownerRaw || '' });
}

// ── Landlords (one per distinct owner) ───────────────────────────────────────
const warnings = [];
const landlords = new Map(); // key → landlord
for (const f of [...flats.values()].sort((a, b) => a.n - b.n)) {
  const o = parseOwner(f.ownerRaw);
  f.owner = o;
  if (!o) continue;
  const key = (o.company ? 'co:' : 'p:') + o.name.toLowerCase();
  const existing = landlords.get(key);
  if (existing) {
    existing.flats.push(f.n);
    if (o.joint && o.joint !== existing.joint) {
      const longer = !existing.joint || o.joint.length > existing.joint.length ? o.joint : existing.joint;
      warnings.push(`${o.name}: joint owner differs between flats ("${existing.joint || '—'}" vs "${o.joint}") → using "${longer}"`);
      existing.joint = longer;
    }
    if (o.email && !existing.email) existing.email = o.email;
  } else {
    landlords.set(key, { ...o, flats: [f.n] });
  }
  if (o.joint && o.joint.split(' ').length === 1) warnings.push(`APT ${f.n}: joint owner is only one word ("${o.joint}") — as in the sheet`);
}

// ── Current ROCA Estates data ────────────────────────────────────────────────
const ph = await emDb('buildings').where('short_code', 'PH').first();
if (!ph) { console.log('REFUSED: no Parsons House building with short code PH'); process.exit(1); }
const oldProps = await emDb('properties').select('*');
const oldPh = new Map(oldProps.filter((p) => p.building_id === ph.id).map((p) => [Number(p.unit_number), p]));
const oldLandlords = await emDb('users').where('role', 'LANDLORD').select('*');
const oldById = new Map(oldLandlords.map((l) => [l.id, l]));
const surname = (name) => clean(name).split(' ').slice(-1)[0]?.toLowerCase();

// Carry email / phone / address from the old owner of the same flat when the
// surname matches; otherwise a clear placeholder email.
for (const l of landlords.values()) {
  for (const n of l.flats) {
    const old = oldById.get(oldPh.get(n)?.landlord_id);
    if (!old) continue;
    const s = l.company ? l.name.toLowerCase().split(' ')[0] : surname(l.name);
    if (s && clean(old.name).toLowerCase().includes(s)) {
      l.carried = { from: old.id, email: old.email, phone: old.phone, address: old.address, city: old.city, postcode: old.postcode, country: old.country };
      break;
    }
  }
  l.email = l.email || l.carried?.email || null;
  l.placeholder = !l.email;
  if (l.placeholder) l.email = `no-email+ph-${String(l.flats[0]).padStart(2, '0')}@rocaestates.invalid`;
}

// ── What will be deleted ─────────────────────────────────────────────────────
const landlordIds = oldLandlords.map((l) => l.id);
const propIds = oldProps.map((p) => p.id);
const idsOr0 = (a) => (a.length ? a : [0]);
const txIds = await emDb('transactions').where((w) => w.whereIn('user_id', idsOr0(landlordIds)).orWhereIn('property_id', idsOr0(propIds))).pluck('id');
const count = async (t, fn) => Number((await fn(emDb(t)).count('* as n').first()).n);
const delPlan = {
  payment_allocations: await count('payment_allocations', (q) => q.whereIn('payment_id', idsOr0(txIds)).orWhereIn('charge_id', idsOr0(txIds))),
  transactions: txIds.length,
  invoices: await count('invoices', (q) => q.whereIn('landlord_id', idsOr0(landlordIds)).orWhereIn('property_id', idsOr0(propIds))),
  tenant_leases: await count('tenant_leases', (q) => q.whereIn('property_id', idsOr0(propIds))),
  'tasks (landlord/flat)': await count('tasks', (q) => q.whereIn('landlord_id', idsOr0(landlordIds)).orWhereIn('property_id', idsOr0(propIds))),
  'documents (landlord/flat)': await count('documents', (q) => q.whereIn('landlord_id', idsOr0(landlordIds)).orWhereIn('property_id', idsOr0(propIds))),
  'folders (flat)': await count('folders', (q) => q.whereIn('property_id', idsOr0(propIds))),
  'property_expenses (flat)': await count('property_expenses', (q) => q.whereIn('property_id', idsOr0(propIds))),
  properties: propIds.length,
  'users (landlords)': landlordIds.length,
};

// ── Report ───────────────────────────────────────────────────────────────────
console.log('WILL DELETE (ROCA Estates):');
for (const [k, v] of Object.entries(delPlan)) console.log(`  ${k.padEnd(28)} ${v}`);
console.log('  kept: buildings, freeholders, admins, communications, Xero lines, activity log');
console.log(`\nWILL CREATE ${landlords.size} LANDLORDS:`);
for (const l of landlords.values()) {
  const shown = l.joint ? `${l.name} & ${l.joint}` : l.name;
  console.log(`  ${shown.padEnd(58)} ${l.company ? 'company ' : 'person  '} flats ${l.flats.join(',').padEnd(18)} ${l.placeholder ? 'NO EMAIL (placeholder)' : l.email}${l.carried ? `  [email/phone/address from old #${l.carried.from}]` : ''}`);
}
const noOwner = [...flats.values()].filter((f) => !f.owner).map((f) => f.n);
console.log(`\nWILL CREATE ${flats.size} FLATS in ${ph.name} (PH_01…PH_${String(Math.max(...flats.keys())).padStart(2, '0')}); flat details (type, size, service charge…) copied from the old flat with the same number.`);
console.log(`  no landlord in the sheet: APT ${noOwner.join(', ')}`);
console.log('\nWARNINGS:'); for (const w of warnings) console.log('  ' + w);
const placeholders = [...landlords.values()].filter((l) => l.placeholder).length;
console.log(`  ${placeholders} landlords have no email (placeholder no-email+ph-NN@rocaestates.invalid) — add real ones in ROCA Estates.`);

// Roca Living links to re-point.
const rlProps = await rlDb('properties').whereNotNull('rocaem_property_id').select('id', 'block_name', 'apartment_number', 'rocaem_property_id', 'landlord_id');
const rlUsers = await rlDb('users').whereNotNull('rocaem_user_id').select('id', 'name', 'rocaem_user_id');
console.log(`\nROCA LIVING RE-LINK: ${rlProps.length} flats, ${rlUsers.length} landlords currently linked`);

if (!APPLY) {
  console.log(`\nDRY RUN — nothing written. To do it: add --apply --em-db=${emName} --rl-db=${rlName}`);
  await emDb.destroy(); await rlDb.destroy();
  process.exit(0);
}

// ── Apply: ROCA Estates ──────────────────────────────────────────────────────
const NEW_COLS = { nrl_number: 'VARCHAR(100) NULL', statement_initials: 'VARCHAR(20) NULL', preferred_statement_email: 'VARCHAR(255) NULL' };
for (const [c, def] of Object.entries(NEW_COLS)) {
  if (!(await emDb.schema.hasColumn('users', c))) { await emDb.raw(`ALTER TABLE users ADD COLUMN \`${c}\` ${def}`); console.log(`added users.${c}`); }
}

const created = { landlords: new Map(), flats: new Map() };
await emDb.transaction(async (trx) => {
  if (txIds.length) {
    await trx('payment_allocations').whereIn('payment_id', txIds).orWhereIn('charge_id', txIds).delete();
    await trx('transactions').whereIn('id', txIds).delete();
  }
  await trx('invoices').whereIn('landlord_id', idsOr0(landlordIds)).orWhereIn('property_id', idsOr0(propIds)).delete();
  await trx('tenant_leases').whereIn('property_id', idsOr0(propIds)).delete();
  await trx('tasks').whereIn('landlord_id', idsOr0(landlordIds)).orWhereIn('property_id', idsOr0(propIds)).delete();
  await trx('documents').whereIn('landlord_id', idsOr0(landlordIds)).orWhereIn('property_id', idsOr0(propIds)).delete();
  await trx('folders').whereIn('property_id', idsOr0(propIds)).delete();
  await trx('tenant_users').whereIn('property_id', idsOr0(propIds)).update({ property_id: null });
  await trx('supplier_invoices').whereIn('property_id', idsOr0(propIds)).update({ property_id: null });
  await trx('supplier_invoices').whereIn('landlord_id', idsOr0(landlordIds)).update({ landlord_id: null });
  await trx('properties').whereIn('id', idsOr0(propIds)).delete();
  await trx('users').whereIn('id', idsOr0(landlordIds)).where('role', 'LANDLORD').delete();

  for (const [key, l] of landlords) {
    const full = l.company ? l.name : l.name;
    const parts = l.name.split(' ');
    const [id] = await trx('users').insert({
      name: full,
      first_name: l.company ? null : parts[0],
      last_name: l.company ? null : parts.slice(1).join(' ') || null,
      email: l.email,
      phone: l.carried?.phone || '0000000000',
      role: 'LANDLORD',
      status: 'PENDING',
      ownership_type: l.company ? 'COMPANY' : 'PERSONAL',
      company_name: l.company ? l.name : null,
      is_joint_ownership: l.joint ? 1 : 0,
      secondary_owner_name: l.joint || null,
      address: l.carried?.address || null,
      city: l.carried?.city || null,
      postcode: l.carried?.postcode || null,
      country: l.carried?.country || null,
      preferred_statement_email: l.email && !l.placeholder ? l.email : null,
    });
    await trx('users').where('id', id).update({ payment_ref: `REM-LND-${String(id).padStart(3, '0')}` });
    created.landlords.set(key, id);
    l.id = id;
  }

  const SKIP = new Set(['id', 'landlord_id', 'property_reference', 'created_at', 'updated_at']);
  for (const f of [...flats.values()].sort((a, b) => a.n - b.n)) {
    const nn = String(f.n).padStart(2, '0');
    const old = oldPh.get(f.n) || {};
    const carried = Object.fromEntries(Object.entries(old).filter(([k]) => !SKIP.has(k)));
    const ownerKey = f.owner ? (f.owner.company ? 'co:' : 'p:') + f.owner.name.toLowerCase() : null;
    const [id] = await trx('properties').insert({
      ...carried,
      building_id: ph.id,
      name: `${ph.name} - Unit ${f.n}`,
      unit_id: `PH_${nn}`,
      unit_number: String(f.n),
      unit_code: old.unit_code || `PA${nn}`,
      landlord_id: ownerKey ? created.landlords.get(ownerKey) : null,
    });
    await trx('properties').where('id', id).update({ property_reference: `REM-APR-${id}` });
    created.flats.set(f.n, id);
  }
});
console.log(`\nROCA Estates: created ${created.landlords.size} landlords and ${created.flats.size} flats.`);

// ── Apply: re-link Roca Living ───────────────────────────────────────
const landlordOfFlat = (n) => {
  const f = flats.get(n);
  if (!f?.owner) return null;
  return created.landlords.get((f.owner.company ? 'co:' : 'p:') + f.owner.name.toLowerCase()) || null;
};
await rlDb.transaction(async (trx) => {
  for (const p of rlProps) {
    const n = String(p.block_name).toUpperCase() === 'PH' ? Number(p.apartment_number) : null;
    const newId = n ? created.flats.get(n) || null : null;
    await trx('properties').where('id', p.id).update({ rocaem_property_id: newId });
    const ownerId = n ? landlordOfFlat(n) : null;
    if (ownerId) await trx('users').where('id', p.landlord_id).update({ rocaem_user_id: ownerId });
    console.log(`  RL property ${p.id} (${p.block_name}-${p.apartment_number}): ROCA Estates flat ${p.rocaem_property_id} → ${newId}; landlord → ${ownerId ?? 'unchanged'}`);
  }
  // Landlord links to ROCA Estates landlords that no longer exist are cleared.
  const valid = new Set(created.landlords.values());
  const stale = await trx('users').whereNotNull('rocaem_user_id').select('id', 'rocaem_user_id');
  for (const u of stale) if (!valid.has(u.rocaem_user_id)) await trx('users').where('id', u.id).update({ rocaem_user_id: null });
});
console.log('Roca Living links updated.');
await emDb.destroy(); await rlDb.destroy();
