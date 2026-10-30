// Upload the client's Dropbox "_PARSONS HOUSE" files into Roca Living's
// Documents, for flats that are in Roca Living (block PH). Files stay in Roca
// Living only: nothing is sent to ROCA Estates (their own document types keep
// them out of move-to-estates.mjs too). Run from the server folder, so it uses
// this server's .env and uploads/ folder:
//
//   node scripts/import-dropbox-documents.mjs --source="<folder>"
//       → DRY RUN (default): where every file would go, writes nothing.
//         <folder> holds the unzipped APARTMENTS and AST folders.
//         Add --list to see every file, not only the totals.
//   node scripts/import-dropbox-documents.mjs --source="<folder>" --apply --rl-db=<roca living db>
//       → does it. The name must match the database this .env connects to.
//
// Where files go (all visible to admin and the flat's landlord; tenants have no login):
//   LANDLORD/STATEMENTS            → landlord, "Statements Before Roca Living" (the
//                                    client's hand-made statements, as plain files)
//   LANDLORD/QUERIES, LETTING AGENT → landlord, "Previous Agent Documents"
//   LANDLORD/MANAGEMENT AGREEMENT, KYC, NRLS, OWNERSHIP → landlord, "Landlord Documents"
//   TENANT/APT, TENANT/TDS         → current tenancy, "Tenancy Agreements & Deposits"
//   …/OLD…, AST/<flat>             → property, "Previous Tenancies"
//   LANDLORD/INVENTORY, REPORTS, MAINTENANCE, PHOTOS → property, "Inventories & Reports"
// Not uploaded: tenant references, guarantors and ID (GDPR); EPC/EICR/electrical
// certificates (listed "To Add as Certificate" — they belong in ROCA Estates'
// Certificates with expiry dates); Word/Excel/zip/video files; the original of a
// file that has a _Redacted copy. Files already uploaded are skipped, so it is
// safe to run again. Back the database up first (mysqldump).
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const LIST = process.argv.includes('--list');
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || null;
const SOURCE = argValue('source');
const mod = (rel) => import(pathToFileURL(path.join(HERE, '..', rel)).href);
const { emDb, default: db } = await mod('src/config/db.js');
const done = async (code = 0) => { await db.destroy(); await emDb.destroy(); process.exit(code); };

if (!SOURCE || !fs.existsSync(path.join(SOURCE, 'APARTMENTS'))) {
  console.log('Pass --source="<folder>" holding the unzipped APARTMENTS (and AST) folders.');
  await done(1);
}
const [[{ d: rlName }]] = await db.raw('SELECT DATABASE() AS d');
if (APPLY && argValue('rl-db') !== rlName) {
  console.log(`REFUSED: connected to ${rlName}. To apply, pass exactly --rl-db=${rlName}`);
  await done(1);
}
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${rlName} (Roca Living), files from ${SOURCE}\n`);

// ── Where a file goes ────────────────────────────────────────────────────────
const UPLOADABLE = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };
const DEST = {
  statements: { scope: 'landlord', folder: 'Statements Before Roca Living', docType: 'statement_before_rl' },
  agent: { scope: 'landlord', folder: 'Previous Agent Documents', docType: 'previous_agent_document' },
  landlord: { scope: 'landlord', folder: 'Landlord Documents', docType: 'landlord_document' },
  tenancy: { scope: 'tenancy', folder: 'Tenancy Agreements & Deposits', docType: 'tenancy_agreement' },
  previous: { scope: 'property', folder: 'Previous Tenancies', docType: 'previous_tenancy' },
  reports: { scope: 'property', folder: 'Inventories & Reports', docType: 'property_report' },
};
const skipType = (ext) => (['.docx', '.doc', '.dotx'].includes(ext) ? 'Word draft (its PDF is uploaded)'
  : ['.xlsx', '.xls', '.csv'].includes(ext) ? 'Spreadsheet (working file)'
    : ext === '.zip' ? 'Zip archive (its files are already in the folder)'
      : ['.mp4', '.mov'].includes(ext) ? 'Video'
        : `File type ${ext || '(none)'} not accepted`);
// "APT_36_PH_EICR.pdf", "EPC doc_…", "Apartment 8 Certfificate" (underscores count as separators).
const isCertificate = (name) => /(^|[^a-z])(EPC|EICR|EIRC|CP12)([^a-z]|$)|energy performance|electrical installation|certf?ificate|gas safe/i.test(name)
  && !/deposit|protection/i.test(name);

// segs: the path inside the flat's folder; area: 'APT' (APARTMENTS) or 'AST'.
const classify = (area, segs) => {
  const name = segs[segs.length - 1];
  const dirs = segs.slice(0, -1).map((s) => s.toUpperCase());
  const ext = path.extname(name).toLowerCase();
  if (dirs.some((d) => /TENANT (GUARANTOR|REFERENCES?)/.test(d))
    || (dirs[0] !== 'LANDLORD' && /\b(ID|passport|identity|right.?to.?rent|payslips?)\b/i.test(name))) {
    return { skip: 'Tenant personal data (GDPR)' };
  }
  if (!UPLOADABLE[ext]) return { skip: skipType(ext) };
  if (isCertificate(name)) return { certificate: true };
  if (area === 'AST') return DEST.previous;
  const top = dirs[0] || '';
  const second = dirs[1] || '';
  if (dirs.some((d) => /(^|[ _])OLD$/.test(d) || d === 'OLD')) return DEST.previous;
  if (top === 'LANDLORD' && second === 'STATEMENTS') return DEST.statements;
  if ((top === 'LANDLORD' && second === 'QUERIES') || top === 'LETTING AGENT' || top === 'AGENT') {
    return second === 'UTILITIES' ? DEST.reports : DEST.agent;
  }
  if ((top === 'LANDLORD' && ['MANAGEMENT AGREEMENT', 'KYC', 'NRLS', 'OWNERSHIP'].includes(second)) || top === 'NRLS'
    || (!top && /landlord_agreement/i.test(name))) return DEST.landlord;
  if (top === 'TENANT') return DEST.tenancy;
  if ((top === 'LANDLORD' && ['INVENTORY', 'MAINTENANCE', 'PHOTOS'].includes(second)) || top === 'REPORTS'
    || top === 'MAINTENANCE' || (!top && UPLOADABLE[ext]?.startsWith('image/'))) return DEST.reports;
  return { check: `No rule for ${segs.slice(0, -1).join('/') || 'the flat folder itself'}` };
};

// ── Walk the folders ─────────────────────────────────────────────────────────
const walk = (dir, base = []) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (
  e.isDirectory() ? walk(path.join(dir, e.name), [...base, e.name]) : [{ abs: path.join(dir, e.name), segs: [...base, e.name] }]));

const files = [];
for (const e of fs.readdirSync(path.join(SOURCE, 'APARTMENTS'), { withFileTypes: true })) {
  const m = e.isDirectory() && /^Apartment (\d+)$/i.exec(e.name);
  if (m) for (const f of walk(path.join(SOURCE, 'APARTMENTS', e.name))) files.push({ ...f, flat: m[1], area: 'APT', shown: `APARTMENTS/${e.name}/${f.segs.join('/')}` });
}
if (fs.existsSync(path.join(SOURCE, 'AST'))) {
  for (const e of fs.readdirSync(path.join(SOURCE, 'AST'), { withFileTypes: true })) {
    const m = e.isDirectory() && /^(\d+) Parsons?$/i.exec(e.name);
    if (!m) continue;
    for (const f of walk(path.join(SOURCE, 'AST', e.name))) {
      // A flat folder copied inside another one ("20 Parsons/3 Parson/…") is a duplicate.
      if (f.segs.length > 1 && /^\d+ Parsons?/i.test(f.segs[0])) continue;
      files.push({ ...f, flat: m[1], area: 'AST', shown: `AST/${e.name}/${f.segs.join('/')}` });
    }
  }
}

// Flats in Roca Living: block PH, with their landlord and current tenancy.
const flats = new Map();
for (const flat of [...new Set(files.map((f) => f.flat))]) {
  const p = await db('properties as p').leftJoin('users as u', 'p.landlord_id', 'u.id')
    .whereRaw('UPPER(p.block_name) = ?', ['PH']).where('p.apartment_number', flat)
    .first('p.id', 'p.landlord_id', 'u.name as landlord_name');
  if (!p) continue;
  const t = await db('tenancies').where('property_id', p.id).whereIn('status', ['active', 'notice', 'pending']).orderBy('id', 'desc').first('id');
  flats.set(flat, { propertyId: p.id, landlordId: p.landlord_id, landlordName: p.landlord_name, tenancyId: t?.id || null });
}

// ── Plan every file ──────────────────────────────────────────────────────────
const plans = [];
const seenHash = new Set();
for (const f of files.sort((a, b) => Number(a.flat) - Number(b.flat) || a.shown.localeCompare(b.shown))) {
  const name = f.segs[f.segs.length - 1];
  const flat = flats.get(f.flat);
  const plan = { ...f, name, label: `PH-${f.flat}` };
  if (!flat) { plans.push({ ...plan, skip: 'Flat not in Roca Living yet' }); continue; }
  const c = classify(f.area, f.segs);
  if (c.certificate) {
    // The same certificate in two Dropbox folders is listed once.
    const key = `cert|${f.flat}|${crypto.createHash('sha1').update(fs.readFileSync(f.abs)).digest('hex')}`;
    plans.push(seenHash.has(key) ? { ...plan, skip: 'Same file twice in Dropbox' } : { ...plan, certificate: true });
    seenHash.add(key);
    continue;
  }
  if (c.skip || c.check) { plans.push({ ...plan, ...c }); continue; }
  // The original of a file that also has a _Redacted copy stays out.
  const redacted = name.replace(/(\.[^.]+)$/, '_Redacted$1');
  if (redacted !== name && fs.existsSync(path.join(path.dirname(f.abs), redacted))) { plans.push({ ...plan, skip: 'Redacted copy uploaded instead' }); continue; }
  const ownerId = c.scope === 'landlord' ? flat.landlordId : c.scope === 'tenancy' ? flat.tenancyId : flat.propertyId;
  if (!ownerId) { plans.push({ ...plan, check: c.scope === 'tenancy' ? 'No current tenancy for this flat' : 'No landlord on this flat' }); continue; }
  const hash = crypto.createHash('sha1').update(fs.readFileSync(f.abs)).digest('hex');
  const key = `${c.scope}|${ownerId}|${hash}`;
  if (seenHash.has(key)) { plans.push({ ...plan, skip: 'Same file twice in Dropbox' }); continue; }
  seenHash.add(key);
  const exists = await db('documents').where({ owner_type: c.scope, owner_id: ownerId, original_name: name }).first('id');
  if (exists) { plans.push({ ...plan, skip: 'Already uploaded' }); continue; }
  plans.push({ ...plan, dest: c, ownerId, size: fs.statSync(f.abs).size });
}

// ── Report ───────────────────────────────────────────────────────────────────
const toUpload = plans.filter((p) => p.dest);
const ownerLabel = (p) => {
  const flat = flats.get(p.flat);
  return p.dest.scope === 'landlord' ? `Landlord ${flat.landlordName}` : p.dest.scope === 'tenancy' ? `Tenancy #${p.ownerId}` : `Property ${p.label}`;
};
for (const flat of [...new Set(plans.map((p) => p.flat))]) {
  const mine = plans.filter((p) => p.flat === flat);
  const up = mine.filter((p) => p.dest);
  if (!flats.has(flat)) continue;
  console.log(`PH-${flat} · ${flats.get(flat).landlordName}`);
  const byDest = new Map();
  for (const p of up) {
    const k = `${ownerLabel(p)} → ${p.dest.folder}`;
    byDest.set(k, [...(byDest.get(k) || []), p]);
  }
  for (const [k, list] of byDest) {
    console.log(`  upload ${String(list.length).padStart(2)}  ${k}`);
    if (LIST) for (const p of list) console.log(`             ${p.shown}`);
  }
  const certs = mine.filter((p) => p.certificate).length;
  const checks = mine.filter((p) => p.check).length;
  const skips = mine.filter((p) => p.skip).length;
  console.log(`  ${certs} to add as certificate, ${checks} to check, ${skips} not uploaded\n`);
}
const notInRl = [...new Set(plans.filter((p) => p.skip === 'Flat not in Roca Living yet').map((p) => p.label))];
if (notInRl.length) console.log(`Not in Roca Living yet (left in Dropbox): ${notInRl.join(', ')}\n`);

const section = (title, list, why) => {
  if (!list.length) return;
  console.log(`${title} (${list.length}):`);
  for (const p of list) console.log(`  ${p.shown}${why ? `  — ${why(p)}` : ''}`);
  console.log('');
};
section('To Add as Certificate (in ROCA Estates → Certificates, with the expiry date)', plans.filter((p) => p.certificate && flats.has(p.flat)));
section('To Check (not uploaded)', plans.filter((p) => p.check), (p) => p.check);
const skipped = plans.filter((p) => p.skip && flats.has(p.flat));
const reasons = new Map();
for (const p of skipped) reasons.set(p.skip, (reasons.get(p.skip) || 0) + 1);
if (skipped.length) {
  console.log(`Not uploaded (${skipped.length}):`);
  for (const [r, n] of reasons) console.log(`  ${String(n).padStart(3)}  ${r}`);
  if (LIST) for (const p of skipped) console.log(`       ${p.shown}  — ${p.skip}`);
  console.log('');
}
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(`To upload: ${toUpload.length} files, ${mb(toUpload.reduce((t, p) => t + p.size, 0))}`);
if (!toUpload.length) { console.log('\nNothing to upload.'); await done(0); }
if (!APPLY) {
  console.log(`\nDRY RUN — nothing changed. Add --list to see every file. To do it: add --apply --rl-db=${rlName}`);
  await done(0);
}

// ── Apply ────────────────────────────────────────────────────────────────────
const admin = await db('users').where('role', 'ADMIN').orderBy('id').first('id');
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const folderIds = new Map();
const folderId = async (trx, name) => {
  if (folderIds.has(name)) return folderIds.get(name);
  let f = await trx('folders').where('name', name).first('id');
  if (!f) { const [id] = await trx('folders').insert({ name, owner_type: 'global' }); f = { id }; }
  folderIds.set(name, f.id);
  return f.id;
};
let uploaded = 0;
for (const flat of [...new Set(toUpload.map((p) => p.flat))]) {
  const list = toUpload.filter((p) => p.flat === flat);
  const copied = [];
  try {
    await db.transaction(async (trx) => {
      for (const p of list) {
        const filename = `file-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(p.name)}`;
        fs.copyFileSync(p.abs, path.join(uploadsDir, filename));
        copied.push(path.join(uploadsDir, filename));
        const [id] = await trx('documents').insert({
          folder_id: await folderId(trx, p.dest.folder),
          owner_type: p.dest.scope,
          owner_id: p.ownerId,
          doc_type: p.dest.docType,
          filename,
          original_name: p.name,
          mime_type: UPLOADABLE[path.extname(p.name).toLowerCase()],
          file_path: `uploads/${filename}`,
          file_size_bytes: p.size,
          uploaded_by: admin?.id || null,
          doc_reference: `TEMP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          landlord_visible: true,
        });
        await trx('documents').where('id', id).update({ doc_reference: `REM-DOC-${String(id).padStart(5, '0')}` });
        await trx('audit_log').insert({
          actor_id: admin?.id || null, actor_role: 'ADMIN', action: 'DOCUMENT_UPLOADED', entity_type: 'document', entity_id: id,
          meta: JSON.stringify({ original_name: p.name, scope: p.dest.scope, owner_id: p.ownerId, dropbox_path: p.shown, source: 'import-dropbox-documents script' }),
        });
      }
    });
    uploaded += list.length;
    console.log(`PH-${flat}: ${list.length} uploaded`);
  } catch (err) {
    for (const f of copied) fs.rmSync(f, { force: true });
    console.log(`PH-${flat}: FAILED, nothing saved for this flat — ${err.message}`);
  }
}
console.log(`\nDone: ${uploaded} files uploaded. Run it again (without --apply): every file should show "Already uploaded".`);
await done(0);
