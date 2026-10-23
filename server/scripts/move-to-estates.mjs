// Move what Roca Living kept on its own into ROCA Estates, so both apps show
// the same: floor plans, certificate dates and files, and landlord/apartment
// documents (generated statements and invoices stay in Roca Living). It also
// lists what the sync will then change in Roca Living's own copies (landlord
// names, emails, addresses; flat addresses), and any flat whose owner differs
// (never changed automatically: confirmed on the property page). Run once,
// after both apps are deployed and ROCAEM_API_URL / ROCAEM_API_KEY are set.
// Run from the server folder, so it uses this server's .env:
//
//   node scripts/move-to-estates.mjs
//       → DRY RUN (default): shows what would move, writes nothing
//   node scripts/move-to-estates.mjs --apply --rl-db=<roca living db>
//       → does it. The name must match the database this .env connects to.
//
// Only fills what ROCA Estates does not have yet; where both have a value,
// ROCA Estates' is kept and the difference is listed. Safe to run again.
// Back both databases up first (mysqldump).
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const load = (p) => import(pathToFileURL(path.join(HERE, p)).href);
const { emDb, default: db } = await load('../src/config/db.js');
const { estatesApi, estatesApiReady, estatesUpload } = await load('../src/utils/estatesApi.js');
const { ESTATE_CERT_FIELDS, isEstatesFile, pullLandlords, pullProperties } = await load('../src/utils/estatesSync.js');
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
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${rlName} (Roca Living) → ROCA Estates\n`);

const ACTING = 'move-to-estates script';
const ymd = (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : (d ? String(d).slice(0, 10) : null));
const localFile = (p) => {
  if (!p || isEstatesFile(p)) return null;
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  return fs.existsSync(abs) ? abs : null;
};
const MIME = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
const fileOf = (field, abs, name) => ({ field, buffer: fs.readFileSync(abs), name: name || path.basename(abs), type: MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
const tally = { floorPlans: 0, certDates: 0, certFiles: 0, documents: 0 };
const kept = []; // both apps had something different: ROCA Estates' kept
const missing = []; // Roca Living row whose file is not on disk

const props = await db('properties').whereNotNull('rocaem_property_id').select('id', 'name', 'rocaem_property_id');
const units = new Map((await emDb('properties').whereIn('id', props.map((p) => p.rocaem_property_id).concat(0))).map((u) => [u.id, u]));

// 1. Floor plans
for (const p of props) {
  const u = units.get(p.rocaem_property_id);
  if (!u) continue;
  const plans = await db('property_images').where({ property_id: p.id, image_type: 'floor_plan' }).whereNull('estates_file').orderBy('created_at', 'desc');
  if (!plans.length) continue;
  if (u.floor_plan) {
    kept.push(`${p.name}: floor plan — ROCA Estates already has one; Roca Living's ${plans.length} kept in Roca Living only`);
    continue;
  }
  const plan = plans[0];
  const abs = localFile(plan.document_path);
  if (!abs) { missing.push(`${p.name}: floor plan file ${plan.document_path}`); continue; }
  console.log(`floor plan  ${p.name}: ${path.basename(abs)}`);
  if (APPLY) {
    const data = await estatesUpload('PATCH', `/properties/${u.id}`, { files: [fileOf('floor_plan', abs)], actingFor: ACTING });
    await db('property_images').where('id', plan.id).update({ estates_file: data?.property?.floor_plan || null });
  }
  tally.floorPlans += 1;
}

// 2. Certificates (dates and file)
const certs = await db('property_certificates').whereIn('property_id', props.map((p) => p.id).concat(0));
for (const c of certs) {
  const f = ESTATE_CERT_FIELDS[c.cert_type];
  const p = props.find((x) => x.id === c.property_id);
  const u = units.get(p.rocaem_property_id);
  if (!f || !u || !(f.date in u)) continue;
  const body = {};
  for (const [mine, theirs] of [[ymd(c.issued_at), f.date], [ymd(c.expires_at), f.expiry]]) {
    if (!mine) continue;
    if (!u[theirs]) body[theirs] = mine;
    else if (ymd(u[theirs]) !== mine) kept.push(`${p.name}: ${c.cert_type} ${theirs} — ROCA Estates ${ymd(u[theirs])}, Roca Living ${mine}`);
  }
  if (Object.keys(body).length) {
    console.log(`certificate ${p.name}: ${c.cert_type} dates ${JSON.stringify(body)}`);
    if (APPLY) await estatesApi('PATCH', `/properties/${u.id}`, { body, actingFor: ACTING });
    tally.certDates += 1;
  }
  if (c.document_path && !isEstatesFile(c.document_path) && !c.estates_file) {
    const abs = localFile(c.document_path);
    if (!abs) { missing.push(`${p.name}: ${c.cert_type} file ${c.document_path}`); continue; }
    if (u[f.file]) {
      kept.push(`${p.name}: ${c.cert_type} file — ROCA Estates already has one; Roca Living shows its own until a new one is uploaded`);
      if (APPLY) await db('property_certificates').where('id', c.id).update({ estates_file: u[f.file] });
      continue;
    }
    console.log(`certificate ${p.name}: ${c.cert_type} file ${path.basename(abs)}`);
    if (APPLY) {
      const data = await estatesUpload('PATCH', `/properties/${u.id}`, { files: [fileOf(f.file, abs, `${c.cert_type}_certificate${path.extname(abs)}`)], actingFor: ACTING });
      await db('property_certificates').where('id', c.id).update({ estates_file: data?.property?.[f.file] || null });
    }
    tally.certFiles += 1;
  }
}

// 3. Landlord and apartment documents
const landlordOf = new Map((await db('users').where('role', 'LANDLORD').whereNotNull('rocaem_user_id').select('id', 'rocaem_user_id')).map((l) => [l.id, l.rocaem_user_id]));
const propertyOf = new Map(props.map((p) => [p.id, p.rocaem_property_id]));
const docs = await db('documents').whereNull('rocaem_document_id').whereIn('owner_type', ['landlord', 'property'])
  .whereIn('doc_type', ['kyc_document', 'property_certificate']);
let categoryId = null;
try { categoryId = (await estatesApi('GET', '/documents/categories'))?.categories?.find((c) => /compliance/i.test(c.name))?.id || null; } catch { /* default category */ }
for (const d of docs) {
  const owner = d.owner_type === 'landlord' ? { landlord_id: landlordOf.get(d.owner_id) } : { property_id: propertyOf.get(d.owner_id) };
  if (!Object.values(owner)[0]) continue; // owner not linked to ROCA Estates
  const abs = localFile(d.file_path);
  if (!abs) { missing.push(`document ${d.original_name} (${d.file_path})`); continue; }
  console.log(`document    ${d.owner_type} ${d.owner_id}: ${d.original_name}`);
  if (APPLY) {
    const data = await estatesUpload('POST', '/documents/upload', {
      fields: { ...owner, ...(categoryId ? { category_id: categoryId } : {}), visibility: d.landlord_visible === 0 ? 'INTERNAL' : 'LANDLORD' },
      files: [fileOf('file', abs, d.original_name)],
      actingFor: ACTING
    });
    await db('documents').where('id', d.id).update({ rocaem_document_id: data?.document?.id || null });
  }
  tally.documents += 1;
}

// 4. Roca Living's own copies, as the sync will keep them
const copies = [];
await pullLandlords({ dryRun: !APPLY, log: copies });
await pullProperties({ dryRun: !APPLY, log: copies });
if (copies.length) console.log(`\nRoca Living copies ${APPLY ? 'updated' : 'the sync will update'} from ROCA Estates:\n  ${copies.join('\n  ')}`);

console.log(`\n${APPLY ? 'Moved' : 'Would move'}: ${tally.floorPlans} floor plan(s), ${tally.certDates} certificate date set(s), ${tally.certFiles} certificate file(s), ${tally.documents} document(s).`);
if (kept.length) console.log(`\nROCA Estates already had a different value (kept):\n  ${kept.join('\n  ')}`);
if (missing.length) console.log(`\nNot moved, file missing on disk:\n  ${missing.join('\n  ')}`);
if (!APPLY) console.log('\nNothing written. To apply: add --apply --rl-db=' + rlName);
await done(0);
