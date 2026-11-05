// Load the Parsons House certificates found in the client's Dropbox (EPC and
// EICR for PH-8, PH-13, PH-19, PH-36) into ROCA Estates — dates and PDF — and
// pull them into Roca Living. Also marks the certificates a flat does not need
// as "Not Required" (Gas where the EPC shows an all-electric flat; HMO and PAT
// for single lets), so they no longer count against the compliance %.
// The list and PDFs ship with the script: scripts/data/certificates.json and
// scripts/data/certificates/. Run from the server folder (uses this .env):
//
//   node scripts/import-certificates.mjs
//       → DRY RUN (default): shows what would change, writes nothing
//   node scripts/import-certificates.mjs --apply --rl-db=<roca living db>
//       → does it. The name must match the database this .env connects to.
//
// Only fills what ROCA Estates does not have yet: a date or file already there
// is kept and listed. Only a certificate with nothing uploaded is marked Not
// Required. Safe to run again. Back both databases up first (mysqldump).
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const load = (p) => import(pathToFileURL(path.join(HERE, p)).href);
const { emDb, default: db } = await load('../src/config/db.js');
const { estatesApi, estatesApiReady, estatesUpload } = await load('../src/utils/estatesApi.js');
const { ESTATE_CERT_FIELDS, pullCertificates } = await load('../src/utils/estatesSync.js');
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

const [[{ d: rlName }]] = await db.raw('SELECT DATABASE() AS d');
if (APPLY && argValue('rl-db') !== rlName) {
  console.log(`REFUSED: connected to ${rlName}. To apply, pass exactly --rl-db=${rlName}`);
  await done(1);
}
if (!estatesApiReady()) {
  console.log('REFUSED: set ROCAEM_API_URL and ROCAEM_API_KEY in .env first (Roca Living writes to ROCA Estates through its API).');
  await done(1);
}
const [[col]] = await db.raw("SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'property_certificates' AND COLUMN_NAME = 'status'");
if (!String(col?.t || '').includes('not_required')) {
  console.log('REFUSED: restart the Roca Living API first (its Phase 42 migration adds the "Not Required" status).');
  await done(1);
}
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${rlName} (Roca Living) → ROCA Estates\n`);

const DATA = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'certificates.json'), 'utf8'));
const FILES = path.join(HERE, 'data', 'certificates');
const ACTING = 'import-certificates script';
const CHECKLIST_CODE = { GAS: 'GAS_CERT', EICR: 'EICR_CERT', EPC: 'EPC_CERT', SMOKE_CO: 'SMOKE_CO' };
const ymd = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : (d ? String(d).slice(0, 10) : null));

// "PH-8" → the Roca Living flat and its ROCA Estates apartment
const flats = new Map();
const flatOf = async (code) => {
  if (flats.has(code)) return flats.get(code);
  const [block, apt] = code.split('-');
  const p = await db('properties').where({ block_name: block, apartment_number: apt }).first();
  const u = p?.rocaem_property_id ? await emDb('properties').where('id', p.rocaem_property_id).first() : null;
  const out = p ? { p, u } : null;
  flats.set(code, out);
  return out;
};

const kept = [];
const problems = [];
const imported = []; // { property_id, type }
const tally = { dates: 0, files: 0, notRequired: 0 };

// 1. Certificates: dates and PDF into ROCA Estates (only where empty)
for (const c of DATA.certificates) {
  const f = ESTATE_CERT_FIELDS[c.type];
  const flat = await flatOf(c.flat);
  if (!flat) { problems.push(`${c.flat}: not found in Roca Living`); continue; }
  if (!flat.u) { problems.push(`${c.flat}: not linked to a ROCA Estates apartment`); continue; }
  const { p, u } = flat;
  const abs = path.join(FILES, c.file);
  if (!fs.existsSync(abs)) { problems.push(`${c.flat} ${c.type}: file ${c.file} missing`); continue; }
  const body = {};
  for (const [mine, theirs] of [[c.issued, f.date], [c.expires, f.expiry]]) {
    if (!u[theirs]) body[theirs] = mine;
    else if (ymd(u[theirs]) !== mine) kept.push(`${c.flat} ${c.type} ${theirs}: ROCA Estates has ${ymd(u[theirs])}, Dropbox says ${mine} — kept ROCA Estates`);
  }
  if (Object.keys(body).length) {
    console.log(`${c.flat} ${c.type}: dates ${JSON.stringify(body)}`);
    if (APPLY) await estatesApi('PATCH', `/properties/${u.id}`, { body, actingFor: ACTING });
    tally.dates += 1;
  }
  if (u[f.file]) {
    kept.push(`${c.flat} ${c.type}: ROCA Estates already has a file — kept`);
  } else {
    console.log(`${c.flat} ${c.type}: file ${c.file}`);
    if (APPLY) {
      await estatesUpload('PATCH', `/properties/${u.id}`, {
        files: [{ field: f.file, buffer: fs.readFileSync(abs), name: `${c.flat}_${c.type}.pdf`, type: 'application/pdf' }],
        actingFor: ACTING
      });
    }
    tally.files += 1;
  }
  if (Object.keys(body).length || !u[f.file]) imported.push({ property_id: p.id, flat: c.flat, type: c.type });
}

// 2. Pull them into Roca Living (dates, file link, status), then tick the checklist
if (APPLY) {
  const n = await pullCertificates();
  console.log(`\nPulled into Roca Living: ${n} certificate row(s) updated`);
  for (const i of imported) {
    const cert = await db('property_certificates').where({ property_id: i.property_id, cert_type: i.type }).first();
    const code = CHECKLIST_CODE[i.type];
    if (code && cert && ['compliant', 'expiring_soon'].includes(cert.status)) {
      await db('compliance_checklist').where({ scope: 'property', entity_id: i.property_id, item_code: code }).where('status', 'pending')
        .update({ status: 'complete', verified_at: db.fn.now() });
    }
    await db('audit_log').insert({
      actor_role: 'SYSTEM', action: 'PROPERTY_CERTIFICATE_IMPORTED', entity_type: 'property', entity_id: i.property_id,
      meta: JSON.stringify({ cert_type: i.type, flat: i.flat, status: cert?.status || null, source: 'client Dropbox' })
    });
  }
}

// 3. Not Required (only a certificate with nothing uploaded)
console.log('');
for (const n of DATA.notRequired) {
  const flat = await flatOf(n.flat);
  if (!flat) { problems.push(`${n.flat}: not found in Roca Living`); continue; }
  for (const type of n.types) {
    const cert = await db('property_certificates').where({ property_id: flat.p.id, cert_type: type }).first();
    if (!cert) { problems.push(`${n.flat} ${type}: no certificate row`); continue; }
    if (cert.status === 'not_required') continue;
    if (cert.issued_at || cert.expires_at || cert.document_path) { kept.push(`${n.flat} ${type}: has dates or a file — left as required`); continue; }
    console.log(`${n.flat} ${type}: Not Required (${n.why})`);
    if (APPLY) {
      await db.transaction(async (trx) => {
        await trx('property_certificates').where('id', cert.id).update({ status: 'not_required', updated_at: trx.fn.now() });
        const code = CHECKLIST_CODE[type];
        if (code) await trx('compliance_checklist').where({ scope: 'property', entity_id: flat.p.id, item_code: code }).update({ status: 'not_applicable', applicable: 0, verified_at: trx.fn.now() });
        await trx('audit_log').insert({
          actor_role: 'SYSTEM', action: 'PROPERTY_CERTIFICATE_NOT_REQUIRED', entity_type: 'property', entity_id: flat.p.id,
          meta: JSON.stringify({ cert_type: type, flat: n.flat, why: n.why })
        });
      });
    }
    tally.notRequired += 1;
  }
}

console.log(`\n${tally.dates} date update(s), ${tally.files} file(s) to ROCA Estates, ${tally.notRequired} marked Not Required.`);
if (kept.length) console.log(`\nKept as they are:\n  ${kept.join('\n  ')}`);
if (problems.length) console.log(`\nProblems:\n  ${problems.join('\n  ')}`);
if (!APPLY) console.log('\nNothing written. To apply: add --apply --rl-db=' + rlName);
await done(problems.length ? 1 : 0);
