// Import Satish's landlord sheet ("Landlords_APT" tab exported as CSV: one row
// per owner, PH-8-LL01 / PH-8-LL02 / PH-2-LC01) into ROCA Estates (Rocaem) and
// Roca Living. Run from the server folder, so it uses this server's .env
// (ROCAEM_DB_* and DB_*):
//
//   node scripts/import-landlords-sheet.mjs "<sheet.csv>"
//       → DRY RUN (default): prints every change, writes nothing
//   node scripts/import-landlords-sheet.mjs "<sheet.csv>" --apply --em-db=<rocaem db> --rl-db=<roca living db>
//       → does it. Both names must match the databases this .env connects to.
//   --skip-tenancy=PH-31,PH-8
//       → leave those flats' tenancies (tenant name, rent) alone, e.g. a test
//         tenancy that should be deleted and re-added with the real start date.
//
// Updates records IN PLACE (ids kept, so Roca Living's links stay valid); it
// never deletes anything. A blank cell never clears a stored value. Running it
// again after --apply must report no changes.
//
// ROCA Estates: landlords (names, emails, phones, addresses, company, joint
// owner, agreement notes) and the flats in the sheet (owner, Let/Vacant).
// Roca Living, onboarded flats only: the linked landlord's copy, bank details,
// Terms of Business signed, lead tenant name, and rent (from the next month not
// yet paid, on a statement or invoiced in Xero, as a completed rent review does).
//
// Self-contained on purpose (only src/config/db.js): it must run on servers
// with older code.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHEET = process.argv.slice(2).find((a) => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const SKIP_TENANCY = new Set((argValue('skip-tenancy') || '').split(',').map((x) => Number(x.trim().replace(/^PH-/i, ''))).filter(Boolean));
if (!SHEET || !fs.existsSync(SHEET)) {
  console.log('Usage: node scripts/import-landlords-sheet.mjs "<sheet.csv>" [--apply --em-db=<name> --rl-db=<name>]');
  process.exit(1);
}
const { emDb, default: rlDb } = await import(pathToFileURL(path.join(HERE, '../src/config/db.js')).href);
const done = async (code = 0) => { await emDb.destroy(); await rlDb.destroy(); process.exit(code); };

const [[{ d: emName }]] = await emDb.raw('SELECT DATABASE() AS d');
const [[{ d: rlName }]] = await rlDb.raw('SELECT DATABASE() AS d');
if (APPLY && (argValue('em-db') !== emName || argValue('rl-db') !== rlName)) {
  console.log(`REFUSED: connected to ${emName} (ROCA Estates) / ${rlName} (Roca Living). To apply, pass exactly --em-db=${emName} --rl-db=${rlName}`);
  await done(1);
}
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${emName} (ROCA Estates) + ${rlName} (Roca Living)\n`);

// ── Text helpers ─────────────────────────────────────────────────────────────
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
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const blank = (v) => v === null || v === undefined || String(v).trim() === '';

const PARTICLES = new Set(['van', 'der', 'de', 'den', 'la', 'le', 'du', 'von']);
const KEEP_UPPER = new Set(['JTLH', 'GKP', 'UK']);
const TYPOS = [[/\bINVETMENTS\b/i, 'INVESTMENTS']];
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
  let v = clean(s);
  for (const [re, to] of TYPOS) v = v.replace(re, to);
  const allCaps = v === v.toUpperCase();
  return v.split(' ').map((w, i) => {
    if (allCaps) return wordCase(w, i);
    if (i > 0 && PARTICLES.has(w.toLowerCase())) return w.toLowerCase();
    return KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
};
const isCompany = (s) => /\b(LTD|LIMITED)\b/i.test(s) || /^JTLH$/i.test(clean(s));
const splitName = (full) => { const p = clean(full).split(' '); return { first: p[0] || null, last: p.slice(1).join(' ') || null }; };
const surname = (name) => clean(name).split(' ').slice(-1)[0]?.toLowerCase() || '';
const money = (s) => { const n = parseFloat(String(s ?? '').replace(/[£,\s]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };
const yes = (s) => /^yes$/i.test(clean(s));
const isPlaceholder = (email) => /@rocaestates\.invalid$/i.test(String(email || ''));

// "Dokter van de Kolkstraat 24, 3864 HB Nijkerkerveen, The Netherlands" →
// { address: 'Dokter van de Kolkstraat 24', city: 'Nijkerkerveen', postcode: '3864 HB', country: 'Netherlands' }
const COUNTRIES = [[/^(the\s+)?netherlands$/i, 'Netherlands'], [/^(united kingdom|uk|england)$/i, 'United Kingdom'], [/^nigeria$/i, 'Nigeria']];
const NL_PC_START = /^(\d{4})\s?([A-Z]{2})\b\s*(.*)$/;
const NL_PC_ONLY = /^(\d{4})\s?([A-Z]{2})$/;
const UK_PC_ONLY = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;
const parseAddress = (raw) => {
  const text = clean(raw);
  if (!text) return null;
  let parts = text.split(',').map(clean).filter(Boolean);
  let country = null; let postcode = null; let city = null;
  parts = parts.filter((p) => {
    const hit = COUNTRIES.find(([re]) => re.test(p));
    if (hit && !country) { country = hit[1]; return false; }
    return true;
  });
  for (let i = parts.length - 1; i >= 0 && !postcode; i--) {
    const p = parts[i];
    let m;
    if ((m = p.match(NL_PC_ONLY))) { postcode = `${m[1]} ${m[2]}`; country = country || 'Netherlands'; parts.splice(i, 1); }
    else if ((m = p.match(UK_PC_ONLY))) { postcode = `${m[1].toUpperCase()} ${m[2].toUpperCase()}`; country = country || 'United Kingdom'; parts.splice(i, 1); }
    else if (/^\d{5,6}$/.test(p)) { postcode = p; parts.splice(i, 1); }
    else if (i > 0 && (m = p.match(NL_PC_START)) && m[3]) { postcode = `${m[1]} ${m[2]}`; city = m[3]; country = country || 'Netherlands'; parts.splice(i, 1); }
  }
  if (!city && parts.length > 1) city = parts.pop();
  if (city) city = city.charAt(0).toUpperCase() + city.slice(1);
  return { address: parts.join(', ') || null, city, postcode, country };
};

// ── Sheet ────────────────────────────────────────────────────────────────────
const rows = parseCsv(fs.readFileSync(SHEET, 'utf8'));
const headerAt = rows.findIndex((r) => clean(r[0]) === 'Development_ID');
if (headerAt < 0) { console.log('REFUSED: no header row starting with Development_ID'); await done(1); }
const H = rows[headerAt].map(clean);
const col = (r, name) => clean(r[H.indexOf(name)]);
if (H.indexOf('Property_ID') < 0 || H.indexOf('Landlord Name') < 0) { console.log('REFUSED: Property_ID / Landlord Name columns missing'); await done(1); }

const flats = new Map(); // n → flat
for (const r of rows.slice(headerAt + 1)) {
  const m = col(r, 'Property_ID').match(/^PH-(\d+)$/i);
  if (!m || !col(r, 'Landlord Name')) continue;
  const n = Number(m[1]);
  const f = flats.get(n) || {
    n,
    tenant: col(r, 'TENANT NAME'),
    rent: money(col(r, 'RENT AMOUNT')),
    occupied: yes(col(r, 'OCCUPIED')),
    onboarded: yes(col(r, 'Onboarded')),
    owners: [],
  };
  f.owners.push({
    ref: col(r, 'Property_Landlord_Reference'),
    corporate: /^corporate$/i.test(col(r, 'Landlord Type')),
    name: col(r, 'Landlord Name'),
    address: col(r, 'Landlord Address'),
    email: col(r, 'Communications_Email').toLowerCase(),
    phone: col(r, 'Landlord_Phone'),
    bank: {
      bank_name: col(r, 'Payment_Bank'),
      account_name: col(r, 'Payment_Account_Name'),
      sort_code: col(r, 'Payment_Sort_Code'),
      account_number: col(r, 'Payment_Account_Number'),
      iban_bic: col(r, 'Payment_IBAN_BIC'),
    },
    agreement: col(r, 'Agreement_Source'),
    verification: col(r, 'Contract_Verification'),
    companyNumber: col(r, 'Company_Number'),
    companyContact: col(r, 'Company_Contact'),
    note: col(r, 'Contract_Review_Note'),
  });
  flats.set(n, f);
}
for (const f of flats.values()) f.owners.sort((a, b) => a.ref.localeCompare(b.ref));

// One landlord per distinct primary owner (JTLH owns many flats; the same
// couple owns PH-26 and PH-33). Data from an onboarded flat wins.
const warnings = [];
const landlords = new Map(); // key → sheet landlord
for (const f of [...flats.values()].sort((a, b) => (b.onboarded - a.onboarded) || (a.n - b.n))) {
  const [p, j] = f.owners;
  const company = p.corporate || isCompany(p.name);
  const name = niceName(p.name);
  const key = (company ? 'co:' : 'p:') + name.toLowerCase();
  const joint = !company && j ? {
    name: niceName(j.name), email: j.email || null, phone: j.phone || null, address: parseAddress(j.address),
  } : null;
  const bank = Object.values(p.bank).some(Boolean) ? p.bank : null;
  const agreementNote = [p.agreement && `Agreement: ${p.agreement}`, p.verification, p.note].filter(Boolean).join(' — ');
  const ll = landlords.get(key);
  if (!ll) {
    landlords.set(key, {
      key, company, name, flats: [f.n], onboarded: f.onboarded,
      email: p.email || null, phone: p.phone || null, address: parseAddress(p.address),
      companyNumber: p.companyNumber || null, companyContact: p.companyContact || null,
      joint, bank, refs: f.owners.map((o) => o.ref), agreementNotes: agreementNote ? [`PH-${f.n}: ${agreementNote}`] : [],
      tob: f.onboarded && /signed/i.test(p.verification || ''), otherEmails: [],
    });
    continue;
  }
  ll.flats.push(f.n);
  ll.refs.push(...f.owners.map((o) => o.ref));
  if (agreementNote) ll.agreementNotes.push(`PH-${f.n}: ${agreementNote}`);
  if (p.email && ll.email && p.email !== ll.email) {
    ll.otherEmails.push(`${p.email} (PH-${f.n})`);
    warnings.push(`${ll.name}: PH-${f.n} gives email ${p.email}, kept ${ll.email} (from PH-${ll.flats[0]}${ll.onboarded ? ', onboarded' : ''}); the other is noted`);
  }
  ll.email = ll.email || p.email || null;
  ll.phone = ll.phone || p.phone || null;
  ll.address = ll.address || parseAddress(p.address);
  ll.bank = ll.bank || bank;
  if (joint) {
    if (!ll.joint || joint.name.length > ll.joint.name.length) {
      if (ll.joint && ll.joint.name !== joint.name) warnings.push(`${ll.name}: joint owner "${ll.joint.name}" vs "${joint.name}" → using "${joint.name}"`);
      ll.joint = { ...joint, email: ll.joint?.email || joint.email, phone: ll.joint?.phone || joint.phone, address: ll.joint?.address || joint.address };
    }
  }
}
for (const f of flats.values()) {
  const [p] = f.owners;
  f.landlordKey = ((p.corporate || isCompany(p.name)) ? 'co:' : 'p:') + niceName(p.name).toLowerCase();
  if (p.note) warnings.push(`PH-${f.n}: sheet note — ${p.note}`);
}

// ── ROCA Estates: current data ───────────────────────────────────────────────
const ph = await emDb('buildings').where('short_code', 'PH').first();
if (!ph) { console.log('REFUSED: no Parsons House building with short code PH'); await done(1); }
const emCols = new Set((await emDb.raw('SHOW COLUMNS FROM users'))[0].map((c) => c.Field));
const hasChangeLog = await emDb.schema.hasTable('change_log');
const emFlats = new Map((await emDb('properties').where('building_id', ph.id).select('*')).map((p) => [Number(p.unit_number), p]));
const emUsers = await emDb('users').select('*');
const emById = new Map(emUsers.map((u) => [u.id, u]));
const emailOwner = new Map(emUsers.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u.id]));

// Which existing ROCA Estates landlord each sheet landlord updates.
const claimed = new Set();
const mentions = (u, word) => !!word && [u.name, u.secondary_owner_name, u.company_name].some((v) => String(v || '').toLowerCase().includes(word));
for (const ll of landlords.values()) {
  const words = ll.company ? [ll.name.split(' ')[0].toLowerCase()] : [surname(ll.name), ll.joint ? surname(ll.joint.name) : null];
  const current = [...new Set(ll.flats.map((n) => emFlats.get(n)?.landlord_id).filter(Boolean))].map((id) => emById.get(id)).filter(Boolean);
  let match = current.find((u) => !claimed.has(u.id) && words.some((w) => mentions(u, w)));
  if (!match && ll.email) match = emUsers.find((u) => u.role === 'LANDLORD' && !claimed.has(u.id) && u.email?.toLowerCase() === ll.email);
  if (!match) match = emUsers.find((u) => u.role === 'LANDLORD' && !claimed.has(u.id) && clean(u.name).toLowerCase() === ll.name.toLowerCase());
  if (match) { ll.emId = match.id; claimed.add(match.id); }
}

// The ROCA Estates user record each sheet landlord should end up with.
const targetFor = (ll, cur) => {
  const t = {};
  const set = (k, v) => { if (!blank(v) && emCols.has(k)) t[k] = v; };
  set('name', ll.name);
  set('ownership_type', ll.company ? 'COMPANY' : 'PERSONAL');
  if (ll.company) {
    set('company_name', ll.name);
    set('company_number', ll.companyNumber);
    set('contact_person', ll.companyContact);
    if (ll.address) { set('company_address', ll.address.address); set('company_city', ll.address.city); set('company_postcode', ll.address.postcode); }
  } else {
    const { first, last } = splitName(ll.name);
    set('first_name', first); set('last_name', last);
  }
  if (ll.email) {
    const taken = emailOwner.get(ll.email);
    if (taken && taken !== cur?.id) warnings.push(`${ll.name}: email ${ll.email} already belongs to ROCA Estates user #${taken} — not changed`);
    else set('email', ll.email);
  }
  set('phone', ll.phone);
  if (ll.address) { set('address', ll.address.address); set('city', ll.address.city); set('postcode', ll.address.postcode); set('country', ll.address.country); }
  if (!ll.company) t.is_joint_ownership = ll.joint ? 1 : 0;
  if (ll.joint) {
    const { first, last } = splitName(ll.joint.name);
    set('secondary_owner_name', ll.joint.name); set('secondary_first_name', first); set('secondary_last_name', last);
    set('secondary_owner_email', ll.joint.email); set('secondary_owner_phone', ll.joint.phone);
    if (ll.joint.address) {
      set('secondary_owner_address', ll.joint.address.address); set('secondary_owner_city', ll.joint.address.city);
      set('secondary_owner_postcode', ll.joint.address.postcode); set('secondary_owner_country', ll.joint.address.country);
    }
  }
  if (t.email && !isPlaceholder(t.email)) set('preferred_statement_email', t.email);
  if (ll.agreementNotes.length) set('agreement_notes', ll.agreementNotes.join('\n'));
  // Sheet references (and any second email) on their own line in the notes, replaced on each run.
  const sheetLine = `Sheet refs: ${ll.refs.join(', ')}${ll.otherEmails.length ? `; also emails ${ll.otherEmails.join(', ')}` : ''}`;
  const kept = String(cur?.notes || '').split('\n').filter((l) => l.trim() && !l.startsWith('Sheet refs:'));
  set('notes', [...kept, sheetLine].join('\n'));
  return t;
};
const diff = (cur, target) => Object.entries(target).filter(([k, v]) => String(cur?.[k] ?? '') !== String(v ?? '')).map(([k, v]) => ({ k, from: cur?.[k] ?? null, to: v }));

// ── Plan: ROCA Estates ───────────────────────────────────────────────────────
const plan = { emUpdates: [], emCreates: [], flatChanges: [], flatCreates: [], rl: [] };
for (const ll of landlords.values()) {
  const cur = ll.emId ? emById.get(ll.emId) : null;
  const target = targetFor(ll, cur);
  ll.target = target;
  ll.after = { ...(cur || {}), ...target };
  if (cur) {
    const changes = diff(cur, target);
    if (changes.length) plan.emUpdates.push({ ll, cur, changes });
  } else {
    plan.emCreates.push({ ll });
  }
}
for (const f of [...flats.values()].sort((a, b) => a.n - b.n)) {
  const flat = emFlats.get(f.n);
  const status = f.occupied ? 'LET' : 'VACANT';
  if (!flat) { plan.flatCreates.push({ f, status }); continue; }
  const ll = landlords.get(f.landlordKey);
  const changes = [];
  if (ll.emId && flat.landlord_id !== ll.emId) changes.push({ k: 'landlord_id', from: flat.landlord_id, to: ll.emId });
  if (!ll.emId) changes.push({ k: 'landlord_id', from: flat.landlord_id, to: `(new) ${ll.name}` });
  if (String(flat.status || '').toUpperCase() !== status) changes.push({ k: 'status', from: flat.status, to: status });
  if (changes.length) plan.flatChanges.push({ f, flat, changes });
}
const stillOwning = new Set([...emFlats.values()].filter((p) => !flats.has(Number(p.unit_number))).map((p) => p.landlord_id));
const orphans = [...emFlats.values()]
  .filter((p) => flats.has(Number(p.unit_number)) && p.landlord_id && !claimed.has(p.landlord_id) && !stillOwning.has(p.landlord_id))
  .map((p) => emById.get(p.landlord_id)).filter(Boolean);

// ── Plan: Roca Living ────────────────────────────────────────────────────────
const rlHas = async (t) => rlDb.schema.hasTable(t);
const [hasPay, hasProfiles, hasXeroInv, hasAlloc] = await Promise.all(['landlord_payment_details', 'landlord_profiles', 'xero_rent_invoices', 'rent_payment_allocations'].map(rlHas));
const rlNice = (value) => { // Roca Living's display rule (utils/names.js): only ALL-CAPS names are recased
  if (value === null || value === undefined) return value;
  const s = String(value).trim().replace(/\s+/g, ' ');
  if (!s || /[a-z]/.test(s)) return s;
  const KEEP = new Set(['UK', 'GB', 'BV', 'NV', 'LLP', 'PLC', 'GKP', 'RL', 'PH', 'DH', 'II', 'III', 'IV']);
  const SPECIAL = { LTD: 'Ltd', LIMITED: 'Limited', AND: 'and', OF: 'of' };
  const titleWord = (w) => w.split(/([-'’])/).map((x) => (/^[-'’]$/.test(x) ? x : x.charAt(0) + x.slice(1).toLowerCase())).join('');
  return s.split(' ').map((w, i) => {
    const bare = w.replace(/[^A-Z0-9]/g, '');
    if (SPECIAL[bare]) return i === 0 ? titleWord(w) : w.replace(bare, SPECIAL[bare]);
    if (KEEP.has(bare) || (bare.length <= 3 && !/[AEIOUY]/.test(bare))) return w;
    return titleWord(w);
  }).join(' ');
};
// Same as estatesLink.estateLandlordName / estateLandlordAddress.
const rlLandlordName = (l) => {
  const main = rlNice(l.ownership_type === 'COMPANY' && l.company_name ? l.company_name : l.name);
  const second = l.is_joint_ownership && l.secondary_owner_name && !String(main).toLowerCase().includes(String(l.secondary_owner_name).toLowerCase())
    ? rlNice(l.secondary_owner_name) : null;
  return second ? `${main} & ${second}` : main;
};
const rlLandlordAddress = (l) => {
  const lines = l.ownership_type === 'COMPANY' && l.company_address
    ? [l.company_address, l.company_city, l.company_postcode]
    : [l.address, l.city, l.postcode, l.country];
  return lines.map((x) => (x ? String(x).trim() : '')).filter(Boolean).join('\n');
};
const titleless = (s) => clean(s).toLowerCase().replace(/^(mr|mrs|miss|ms|mx|dr)\.?\s+/, '');

const rlUsers = await rlDb('users').where('role', 'LANDLORD').select('*');
const rlEmailOwner = new Map((await rlDb('users').select('id', 'email')).filter((u) => u.email).map((u) => [u.email.toLowerCase(), u.id]));
const rlProps = await rlDb('properties').whereNotNull('rocaem_property_id').select('*');
const rlPropByEm = new Map(rlProps.map((p) => [p.rocaem_property_id, p]));

for (const ll of landlords.values()) {
  if (!ll.emId) continue;
  const u = rlUsers.find((x) => x.rocaem_user_id === ll.emId);
  if (!u) {
    if (ll.onboarded) warnings.push(`${ll.name} (onboarded): no Roca Living landlord is linked to ROCA Estates #${ll.emId} — switch the flat to Managed in Roca Living, then run this again`);
    continue;
  }
  ll.rlUser = u;
  const copy = { name: rlLandlordName(ll.after), phone: ll.after.phone || '', address: rlLandlordAddress(ll.after) || null };
  const email = ll.after.email && !isPlaceholder(ll.after.email) ? ll.after.email.toLowerCase() : null;
  if (email && email !== String(u.email || '').toLowerCase()) {
    const taken = rlEmailOwner.get(email);
    if (taken && taken !== u.id) warnings.push(`${ll.name}: email ${email} is already used by Roca Living user #${taken} — Roca Living copy keeps ${u.email}`);
    else copy.email = email;
  }
  const changes = diff(u, copy);
  if (changes.length) plan.rl.push({ kind: 'landlord copy', label: `RL landlord #${u.id}`, apply: (trx) => trx('users').where('id', u.id).update({ ...copy, updated_at: trx.fn.now() }), changes, audit: ['SHEET_IMPORT_LANDLORD_UPDATED', 'user', u.id] });

  if (ll.onboarded && ll.bank && hasPay) {
    const b = { bank_name: ll.bank.bank_name, account_name: ll.bank.account_name, sort_code: ll.bank.sort_code, account_number: ll.bank.account_number, iban_bic: ll.bank.iban_bic || null };
    const missing = ['bank_name', 'account_name', 'sort_code', 'account_number'].filter((k) => blank(b[k]));
    if (missing.length) warnings.push(`${ll.name}: bank details incomplete in the sheet (${missing.join(', ')}) — not imported`);
    else {
      const cur = await rlDb('landlord_payment_details').where('user_id', u.id).first();
      const bChanges = diff(cur, b);
      if (bChanges.length) {
        plan.rl.push({
          kind: 'bank details', label: `RL landlord #${u.id} ${ll.name}`, changes: bChanges, audit: ['SHEET_IMPORT_BANK_DETAILS', 'user', u.id],
          apply: async (trx) => {
            const row = { ...b, verified_at: trx.fn.now(), change_pending: 0, updated_at: trx.fn.now() };
            if (cur) await trx('landlord_payment_details').where('id', cur.id).update(row);
            else await trx('landlord_payment_details').insert({ ...row, user_id: u.id });
          },
        });
      }
    }
  }
  if (ll.tob && hasProfiles) {
    const prof = await rlDb('landlord_profiles').where('user_id', u.id).first();
    if (!prof) warnings.push(`${ll.name}: no Roca Living landlord profile — Terms of Business not marked signed`);
    else if (prof.tob_status !== 'signed') {
      plan.rl.push({ kind: 'terms of business', label: `RL landlord #${u.id} ${ll.name}`, changes: [{ k: 'tob_status', from: prof.tob_status, to: 'signed' }], audit: ['SHEET_IMPORT_TOB_SIGNED', 'user', u.id], apply: (trx) => trx('landlord_profiles').where('id', prof.id).update({ tob_status: 'signed', updated_at: trx.fn.now() }) });
    }
  }
}

// Tenancies of onboarded flats: lead tenant name and rent.
for (const f of [...flats.values()].filter((x) => x.onboarded).sort((a, b) => a.n - b.n)) {
  if (SKIP_TENANCY.has(f.n)) { warnings.push(`PH-${f.n}: tenancy left as it is (--skip-tenancy); sheet says tenant ${f.tenant || '—'}, rent ${f.rent ? `£${f.rent.toFixed(2)}` : '—'}`); continue; }
  const emFlat = emFlats.get(f.n);
  const p = emFlat ? rlPropByEm.get(emFlat.id) : null;
  if (!p) { warnings.push(`PH-${f.n} (onboarded): no Roca Living property linked — switch it to Managed in Roca Living, then run this again`); continue; }
  if (!p.managed_by_rl && 'managed_by_rl' in p) warnings.push(`PH-${f.n} (onboarded): Roca Living property #${p.id} is not marked Managed`);
  const t = await rlDb('tenancies').where('property_id', p.id).whereIn('status', ['active', 'notice', 'pending']).orderBy('start_date', 'desc').first();
  if (!t) { warnings.push(`PH-${f.n} (onboarded): no current tenancy in Roca Living (sheet tenant: ${f.tenant || '—'}) — add it in Roca Living (start date needed)`); continue; }

  const lead = await rlDb('tenants').where({ tenancy_id: t.id, is_lead_tenant: 1 }).first();
  const sheetLead = clean(f.tenant.split('&')[0]);
  if (lead && sheetLead && !/^empty$/i.test(sheetLead) && titleless(lead.name) !== titleless(sheetLead)) {
    plan.rl.push({ kind: 'tenant name', label: `PH-${f.n} tenancy #${t.id}`, changes: [{ k: 'lead tenant', from: lead.name, to: sheetLead }], audit: ['SHEET_IMPORT_TENANT_RENAMED', 'tenancy', t.id], apply: (trx) => trx('tenants').where('id', lead.id).update({ name: sheetLead }) });
  }

  if (f.rent && Math.abs(parseFloat(t.rent_pcm) - f.rent) > 0.004) {
    // A month is fixed once money is allocated to it, it is on a statement, it
    // is marked paid, or a Xero rent invoice exists for it. The new rent starts
    // from the month after the last fixed one.
    const months = await rlDb('rent_schedules').where('tenancy_id', t.id).orderBy('due_date').select('*');
    const allocated = hasAlloc ? new Set(await rlDb('rent_payment_allocations').whereIn('schedule_id', months.map((m) => m.id).concat(0)).distinct('schedule_id').pluck('schedule_id')) : new Set();
    const invoices = hasXeroInv ? await rlDb('xero_rent_invoices').where('tenancy_id', t.id).whereNot('status', 'voided').select('due_date') : [];
    const ymd = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : String(d).slice(0, 10));
    let lastFixed = -1;
    months.forEach((m, i) => {
      const from = ymd(m.due_date); const to = months[i + 1] ? ymd(months[i + 1].due_date) : '9999-12-31';
      const invoiced = invoices.some((x) => ymd(x.due_date) >= from && ymd(x.due_date) < to);
      if (allocated.has(m.id) || m.status === 'paid' || invoiced) lastFixed = i;
    });
    const change = months.slice(lastFixed + 1);
    const fromYmd = change[0] ? ymd(change[0].due_date) : null;
    plan.rl.push({
      kind: 'rent', label: `PH-${f.n} tenancy #${t.id}`,
      changes: [{ k: 'rent_pcm', from: t.rent_pcm, to: f.rent.toFixed(2) }, { k: 'rent months changed', from: `${months.length - change.length} kept`, to: change.length ? `${change.length} from ${fromYmd}` : 'none (all months fixed)' }],
      audit: ['SHEET_IMPORT_RENT_CHANGED', 'tenancy', t.id, { old_rent: t.rent_pcm, new_rent: f.rent.toFixed(2), from: fromYmd, months_changed: change.length }],
      apply: async (trx) => {
        if (change.length) await trx('rent_schedules').whereIn('id', change.map((m) => m.id)).update({ amount: f.rent.toFixed(2) });
        await trx('tenancies').where('id', t.id).update({ rent_pcm: f.rent.toFixed(2), updated_at: trx.fn.now() });
        if (parseFloat(p.rent_pcm) === parseFloat(t.rent_pcm)) await trx('properties').where('id', p.id).update({ rent_pcm: f.rent.toFixed(2) });
      },
    });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const show = (v) => (v === null || v === undefined || v === '' ? '—' : String(v).replace(/\n/g, ' ⏎ '));
console.log(`SHEET: ${flats.size} flats (PH-${[...flats.keys()].sort((a, b) => a - b).join(', PH-')}), ${landlords.size} landlords, ${[...flats.values()].filter((f) => f.onboarded).length} onboarded`);
console.log(`\nROCA ESTATES — landlords to UPDATE (${plan.emUpdates.length}):`);
for (const { ll, cur, changes } of plan.emUpdates) {
  console.log(`  #${cur.id} ${cur.name} → ${ll.name} [flats ${ll.flats.join(',')}]`);
  for (const c of changes) console.log(`      ${c.k.padEnd(24)} ${show(c.from)}  →  ${show(c.to)}`);
}
console.log(`\nROCA ESTATES — landlords to CREATE (${plan.emCreates.length}):`);
for (const { ll } of plan.emCreates) console.log(`  ${ll.name} [flats ${ll.flats.join(',')}] ${ll.email || 'no email (placeholder)'}`);
console.log(`\nROCA ESTATES — flats to change (${plan.flatChanges.length}), to create (${plan.flatCreates.length}):`);
for (const { f, flat, changes } of plan.flatChanges) console.log(`  PH-${f.n} #${flat.id}: ${changes.map((c) => `${c.k} ${show(c.from)} → ${show(c.to)}`).join('; ')}`);
for (const { f, status } of plan.flatCreates) console.log(`  PH-${f.n}: NEW flat, ${status}`);
console.log(`\nROCA LIVING (${plan.rl.length}):`);
for (const r of plan.rl) {
  console.log(`  ${r.kind}: ${r.label}`);
  for (const c of r.changes) console.log(`      ${String(c.k).padEnd(24)} ${show(c.from)}  →  ${show(c.to)}`);
}
if (orphans.length) {
  console.log('\nLEFT WITHOUT FLATS (not deleted — delete in Roca Living / ROCA Estates if no longer needed):');
  for (const u of orphans) console.log(`  #${u.id} ${u.name}`);
}
console.log('\nWARNINGS:');
for (const w of [...new Set(warnings)]) console.log('  ' + w);
for (const ll of landlords.values()) if (!ll.email) console.log(`  ${ll.name}: no email in the sheet`);

const total = plan.emUpdates.length + plan.emCreates.length + plan.flatChanges.length + plan.flatCreates.length + plan.rl.length;
if (!total) { console.log('\nNO CHANGES — everything already matches the sheet.'); await done(0); }
if (!APPLY) {
  console.log(`\nDRY RUN — ${total} change group(s), nothing written. To do it: add --apply --em-db=${emName} --rl-db=${rlName}`);
  await done(0);
}

// ── Apply: ROCA Estates ──────────────────────────────────────────────────────
const NEW_COLS = { nrl_number: 'VARCHAR(100) NULL', statement_initials: 'VARCHAR(20) NULL', preferred_statement_email: 'VARCHAR(255) NULL' };
for (const [c, def] of Object.entries(NEW_COLS)) {
  if (!emCols.has(c)) { await emDb.raw(`ALTER TABLE users ADD COLUMN \`${c}\` ${def}`); console.log(`added users.${c}`); }
}
const logChange = async (trx, entity_type, entity_id, entity_label, action, fields) => {
  if (!hasChangeLog) return;
  await trx('change_log').insert({ entity_type, entity_id, entity_label: String(entity_label || '').slice(0, 255), action, fields: fields?.length ? JSON.stringify(fields) : null, user_name: 'Landlord sheet import' });
};
await emDb.transaction(async (trx) => {
  for (const { ll, cur, changes } of plan.emUpdates) {
    await trx('users').where('id', cur.id).update(Object.fromEntries(changes.map((c) => [c.k, c.to])));
    await logChange(trx, 'landlord', cur.id, ll.name, 'update', changes.map((c) => c.k));
  }
  for (const { ll } of plan.emCreates) {
    const row = { ...ll.target, role: 'LANDLORD', status: 'PENDING' };
    if (!row.email) row.email = `no-email+ph-${String(ll.flats[0]).padStart(2, '0')}@rocaestates.invalid`;
    if (!row.phone) row.phone = '0000000000';
    const [id] = await trx('users').insert(row);
    await trx('users').where('id', id).update({ payment_ref: `REM-LND-${String(id).padStart(3, '0')}` });
    ll.emId = id;
    await logChange(trx, 'landlord', id, ll.name, 'create', Object.keys(row));
  }
  for (const { f, flat, changes } of plan.flatChanges) {
    const ll = landlords.get(f.landlordKey);
    const update = {};
    for (const c of changes) update[c.k] = c.k === 'landlord_id' ? ll.emId : c.to;
    await trx('properties').where('id', flat.id).update(update);
    await logChange(trx, 'apartment', flat.id, flat.name, 'update', Object.keys(update));
  }
  for (const { f, status } of plan.flatCreates) {
    const nn = String(f.n).padStart(2, '0');
    const [id] = await trx('properties').insert({
      building_id: ph.id, name: `${ph.name} - Unit ${f.n}`, unit_id: `PH_${nn}`, unit_number: String(f.n),
      unit_code: `${ph.short_code}${nn}`, status, landlord_id: landlords.get(f.landlordKey).emId,
    });
    await trx('properties').where('id', id).update({ property_reference: `REM-APR-${id}` });
    await logChange(trx, 'apartment', id, `${ph.name} - Unit ${f.n}`, 'create', ['building_id', 'unit_number', 'status', 'landlord_id']);
  }
});
console.log(`\nROCA Estates: ${plan.emUpdates.length} landlords updated, ${plan.emCreates.length} created, ${plan.flatChanges.length} flats changed, ${plan.flatCreates.length} created.`);

// ── Apply: Roca Living ───────────────────────────────────────────────────────
const admin = await rlDb('users').where('role', 'ADMIN').orderBy('id').first('id');
await rlDb.transaction(async (trx) => {
  for (const r of plan.rl) {
    await r.apply(trx);
    const [action, entity_type, entity_id, meta] = r.audit;
    await trx('audit_log').insert({
      actor_id: admin?.id || null, actor_role: 'ADMIN', action, entity_type, entity_id,
      meta: JSON.stringify(meta || { fields: r.changes.map((c) => c.k), source: path.basename(SHEET) }),
    });
  }
});
console.log(`Roca Living: ${plan.rl.length} change(s) applied. Run the dry run again: it should say NO CHANGES.`);
await done(0);
