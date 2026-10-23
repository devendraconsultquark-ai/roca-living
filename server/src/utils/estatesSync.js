import fs from 'fs';
import path from 'path';
import db, { emDb } from '../config/db.js';
import logger from './logger.js';
import { estatesApiReady } from './estatesApi.js';
import { estateLandlordName, estateLandlordAddress, estateUnitAddress } from './estatesLink.js';
import { toYmd } from './dateHelpers.js';

// ROCA Estates is where landlords, apartments, certificates, floor plans and
// landlord/apartment documents are kept. Roca Living keeps its own rows for
// them (its tenancies, statements, reports, reminders and landlord portal all
// read those), so this module keeps them in step with ROCA Estates:
//   - edits made in Roca Living are sent to ROCA Estates first (the controllers);
//   - edits made in ROCA Estates are pulled in here, before admin and landlord
//     pages load (at most every few seconds).
// Certificate dates follow ROCA Estates whenever it has one; Roca Living's own
// value stays only where ROCA Estates is still blank (not moved across yet).

// Roca Living certificate → ROCA Estates apartment fields.
export const ESTATE_CERT_FIELDS = {
  EPC: { date: 'epc_start_date', expiry: 'epc_expiry_date', file: 'epc_file' },
  EICR: { date: 'eicr_start_date', expiry: 'eicr_expiry_date', file: 'eicr_file' },
  GAS: { date: 'gas_safety_date', expiry: 'gas_safety_expiry_date', file: 'gas_safety_file' },
  SMOKE_CO: { date: 'smoke_detector_date', expiry: 'smoke_detector_expiry_date', file: 'smoke_detector_file' },
  HMO: { date: 'hmo_licence_date', expiry: 'hmo_licence_expiry_date', file: 'hmo_licence_file' },
  PAT: { date: 'pat_date', expiry: 'pat_expiry_date', file: 'pat_file' }
};

// Marker stored as a file path when the file itself is kept in ROCA Estates.
export const ESTATES_FILE = 'estates:';
export const isEstatesFile = (p) => String(p || '').startsWith(ESTATES_FILE);

// compliant / expiring_soon (within 90 days) / expired; not_uploaded when empty.
export const certStatusFor = ({ issued, expires, hasFile }) => {
  if (!issued && !expires && !hasFile) return 'not_uploaded';
  if (!expires) return 'compliant';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 90);
  const exp = new Date(`${toYmd(expires)}T00:00:00`);
  if (exp < today) return 'expired';
  if (exp < soon) return 'expiring_soon';
  return 'compliant';
};

// The certificate columns ROCA Estates has (an older ROCA Estates has fewer).
let certColumns = null;
const estateCertColumns = async () => {
  if (certColumns) return certColumns;
  const info = await emDb('properties').columnInfo();
  const wanted = Object.values(ESTATE_CERT_FIELDS).flatMap((f) => [f.date, f.expiry, f.file]).concat('floor_plan');
  const present = wanted.filter((c) => info[c]);
  if (present.length === wanted.length) certColumns = present;
  return present;
};

const removeLocalFile = (p) => {
  if (!p || isEstatesFile(p)) return;
  const abs = path.join(process.cwd(), p);
  fs.promises.unlink(abs).catch(() => {});
};

// Landlord name, email, phone, address and company name. With dryRun nothing
// is written; each change is described in `log` (the move script's preview).
export const pullLandlords = async ({ dryRun = false, log = [] } = {}) => {
  const rows = await db('users').where('role', 'LANDLORD').whereNotNull('rocaem_user_id')
    .select('id', 'rocaem_user_id', 'name', 'email', 'phone', 'address');
  if (!rows.length) return 0;
  const em = await emDb('users').where('role', 'LANDLORD').whereIn('id', rows.map((r) => r.rocaem_user_id))
    .select('id', 'name', 'email', 'phone', 'address', 'city', 'postcode', 'country', 'ownership_type', 'company_name',
      'company_address', 'company_city', 'company_postcode', 'is_joint_ownership', 'secondary_owner_name');
  const byId = new Map(em.map((l) => [l.id, l]));
  let changed = 0;
  for (const r of rows) {
    const l = byId.get(r.rocaem_user_id);
    if (!l) continue;
    const patch = {};
    const name = estateLandlordName(l);
    if (name && name !== r.name) patch.name = name;
    const address = estateLandlordAddress(l);
    if (address && address !== r.address) patch.address = address;
    if (l.phone && l.phone !== r.phone) patch.phone = String(l.phone).slice(0, 20);
    const email = l.email ? String(l.email).trim().toLowerCase() : null;
    // The email is the landlord's Roca Living login: only taken when no other account uses it.
    if (email && email !== String(r.email || '').toLowerCase()) {
      const taken = await db('users').whereRaw('LOWER(email) = ?', [email]).whereNot('id', r.id).first('id');
      if (!taken) patch.email = email;
    }
    const company = l.ownership_type === 'COMPANY' && l.company_name ? String(l.company_name).trim() : null;
    const profile = company ? await db('landlord_profiles').where('user_id', r.id).first('company_name') : null;
    if (profile && profile.company_name !== company) patch.company_name = company;
    if (!Object.keys(patch).length) continue;
    for (const [k, v] of Object.entries(patch)) {
      log.push(`landlord ${r.name}: ${k} ${JSON.stringify(k === 'company_name' ? profile.company_name : r[k])} → ${JSON.stringify(v)}`);
    }
    changed += 1;
    if (dryRun) continue;
    const { company_name: companyName, ...userPatch } = patch;
    if (Object.keys(userPatch).length) await db('users').where('id', r.id).update(userPatch);
    if (companyName) await db('landlord_profiles').where('user_id', r.id).update({ company_name: companyName });
  }
  return changed;
};

// Apartment name and address (when ROCA Estates has a complete one). The owner
// is never changed here: moving a flat to another landlord moves its future
// statements and Xero landlord bills, so an admin confirms it on the property
// page (see estatesOwnerDiffers); the difference is noted once in the audit log.
export const pullProperties = async ({ dryRun = false, log = [] } = {}) => {
  const rows = await db('properties').whereNotNull('rocaem_property_id')
    .select('id', 'rocaem_property_id', 'landlord_id', 'name', 'address_line1', 'address_line2', 'city', 'postcode');
  if (!rows.length) return 0;
  const units = await emDb('properties as p')
    .leftJoin('buildings as b', 'p.building_id', 'b.id')
    .leftJoin('users as l', 'p.landlord_id', 'l.id')
    .whereIn('p.id', rows.map((r) => r.rocaem_property_id))
    .select('p.id', 'p.name', 'p.unit_code', 'p.unit_id', 'p.unit_number', 'p.landlord_id', 'p.address', 'p.city', 'p.postcode',
      'b.name as building_name', 'b.short_code as building_short_code', 'b.address as building_address',
      'b.city as building_city', 'b.postcode as building_postcode', 'l.name as landlord_name');
  const byId = new Map(units.map((u) => [u.id, u]));
  const owners = await db('users').where('role', 'LANDLORD').select('id', 'rocaem_user_id');
  const rocaemOf = new Map(owners.map((o) => [o.id, o.rocaem_user_id]));
  let changed = 0;
  for (const r of rows) {
    const u = byId.get(r.rocaem_property_id);
    if (!u) continue;
    const patch = {};
    if (u.name && u.name !== r.name) patch.name = u.name;
    const addr = estateUnitAddress(u);
    if (addr.postcode) {
      for (const k of ['address_line1', 'address_line2', 'city', 'postcode']) {
        if ((addr[k] || null) !== (r[k] || null)) patch[k] = addr[k] ?? null;
      }
    }
    if (u.landlord_id && u.landlord_id !== rocaemOf.get(r.landlord_id)) {
      log.push(`flat ${r.name}: ROCA Estates owner is ${u.landlord_name || `#${u.landlord_id}`} — NOT changed automatically, confirm on the property page`);
      if (!dryRun) {
        const noted = await db('audit_log').where({ action: 'ESTATE_OWNER_DIFFERS', entity_type: 'property', entity_id: r.id })
          .where('meta', 'like', `%"rocaem_landlord_id":${u.landlord_id}}%`).first('id');
        if (!noted) {
          await db('audit_log').insert({
            actor_role: 'SYSTEM', action: 'ESTATE_OWNER_DIFFERS', entity_type: 'property', entity_id: r.id,
            meta: JSON.stringify({ landlord_id: r.landlord_id, rocaem_landlord_id: u.landlord_id }), ip_address: null
          });
        }
      }
    }
    if (!Object.keys(patch).length) continue;
    for (const [k, v] of Object.entries(patch)) log.push(`flat ${r.name}: ${k} ${JSON.stringify(r[k])} → ${JSON.stringify(v)}`);
    changed += 1;
    if (!dryRun) await db('properties').where('id', r.id).update({ ...patch, updated_at: db.fn.now() });
  }
  return changed;
};

// The owner ROCA Estates has for a linked flat, when it is not the flat's
// Roca Living landlord (shown on the property page to confirm). Null otherwise.
export const estatesOwnerDiffers = async (property) => {
  if (!property?.rocaem_property_id) return null;
  try {
    const u = await emDb('properties as p').leftJoin('users as l', 'p.landlord_id', 'l.id')
      .where('p.id', property.rocaem_property_id).first('p.landlord_id', 'l.name', 'l.email');
    if (!u?.landlord_id) return null;
    const mine = await db('users').where('id', property.landlord_id).first('rocaem_user_id');
    return mine?.rocaem_user_id === u.landlord_id ? null : { rocaem_id: u.landlord_id, name: u.name, email: u.email };
  } catch {
    return null; // ROCA Estates unreachable
  }
};

// Certificates and the floor plan.
export const pullCertificates = async () => {
  const cols = await estateCertColumns();
  const certs = await db('property_certificates as c')
    .join('properties as p', 'c.property_id', 'p.id')
    .whereNotNull('p.rocaem_property_id')
    .select('c.id', 'c.property_id', 'c.cert_type', 'c.issued_at', 'c.expires_at', 'c.status', 'c.document_path', 'c.estates_file', 'p.rocaem_property_id');
  const props = await db('properties').whereNotNull('rocaem_property_id').select('id', 'rocaem_property_id');
  if (!props.length) return 0;
  const units = await emDb('properties').whereIn('id', props.map((p) => p.rocaem_property_id)).select('id', ...cols);
  const byId = new Map(units.map((u) => [u.id, u]));
  let changed = 0;

  for (const c of certs) {
    const f = ESTATE_CERT_FIELDS[c.cert_type];
    const u = byId.get(c.rocaem_property_id);
    if (!f || !u || !cols.includes(f.date)) continue;
    const issued = toYmd(u[f.date]) || toYmd(c.issued_at);
    const expires = toYmd(u[f.expiry]) || toYmd(c.expires_at);
    const emFile = u[f.file] || null;
    const patch = {};
    if (issued !== toYmd(c.issued_at)) patch.issued_at = issued;
    if (expires !== toYmd(c.expires_at)) patch.expires_at = expires;
    let docPath = c.document_path;
    if (emFile !== (c.estates_file || null)) {
      // Only a file that came from ROCA Estates is deleted here; one uploaded in
      // Roca Living before the two were linked stays on disk (the move script
      // reports it).
      if (emFile) {
        // A new file in ROCA Estates (one sent from here already has estates_file set).
        if (c.estates_file) removeLocalFile(c.document_path);
        docPath = `${ESTATES_FILE}${f.file}`;
      } else if (c.estates_file) {
        removeLocalFile(c.document_path);
        docPath = null; // removed in ROCA Estates
      }
      patch.estates_file = emFile;
      patch.document_path = docPath;
    }
    const status = certStatusFor({ issued, expires, hasFile: !!docPath });
    if (status !== c.status) patch.status = status;
    if (Object.keys(patch).length) {
      await db('property_certificates').where('id', c.id).update({ ...patch, updated_at: db.fn.now() });
      changed += 1;
    }
  }

  // Floor plan: ROCA Estates keeps one per apartment.
  if (cols.includes('floor_plan')) {
    const plans = await db('property_images').where('image_type', 'floor_plan').whereNotNull('estates_file')
      .whereIn('property_id', props.map((p) => p.id)).select('id', 'property_id', 'estates_file', 'document_path');
    const planOf = new Map();
    for (const pl of plans) planOf.set(pl.property_id, [...(planOf.get(pl.property_id) || []), pl]);
    for (const p of props) {
      const emPlan = byId.get(p.rocaem_property_id)?.floor_plan || null;
      const mine = planOf.get(p.id) || [];
      if (emPlan && mine.some((m) => m.estates_file === emPlan)) continue;
      if (!emPlan && !mine.length) continue;
      for (const m of mine) {
        await db('property_images').where('id', m.id).delete();
        removeLocalFile(m.document_path);
      }
      if (emPlan) {
        await db('property_images').insert({
          property_id: p.id, image_type: 'floor_plan', is_primary: false,
          document_path: `${ESTATES_FILE}floor_plan`, estates_file: emPlan, caption: null
        });
      }
      changed += 1;
    }
  }
  return changed;
};

const DOC_FOLDERS = { landlord: 'Landlord Compliance Documents', property: 'Property Gas & Safety Certs' };
const DOC_TYPES = { landlord: 'kyc_document', property: 'property_certificate' };
const MIME = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv': 'text/csv', '.txt': 'text/plain' };

export const folderFor = async (scope) => {
  const name = DOC_FOLDERS[scope];
  const f = await db('folders').where('name', name).first('id');
  if (f) return f.id;
  const [id] = await db('folders').insert({ name, owner_type: 'global' });
  return id;
};

// Landlord and apartment documents.
export const pullDocuments = async () => {
  const landlords = await db('users').where('role', 'LANDLORD').whereNotNull('rocaem_user_id').select('id', 'rocaem_user_id');
  const props = await db('properties').whereNotNull('rocaem_property_id').select('id', 'rocaem_property_id');
  const landlordOf = new Map(landlords.map((l) => [l.rocaem_user_id, l.id]));
  const propertyOf = new Map(props.map((p) => [p.rocaem_property_id, p.id]));
  const emDocs = (landlords.length || props.length)
    ? await emDb('documents')
      .where((w) => w.whereIn('landlord_id', [...landlordOf.keys(), 0]).orWhereIn('property_id', [...propertyOf.keys(), 0]))
      .select('id', 'landlord_id', 'property_id', 'original_name', 'file_size', 'visibility', 'created_at')
    : [];
  const mirrors = await db('documents').whereNotNull('rocaem_document_id').select('id', 'rocaem_document_id', 'file_path', 'landlord_visible');
  const mirrorOf = new Map(mirrors.map((m) => [m.rocaem_document_id, m]));
  let changed = 0;

  for (const d of emDocs) {
    const visible = d.visibility !== 'INTERNAL';
    const m = mirrorOf.get(d.id);
    if (m) {
      if (!!m.landlord_visible !== visible) {
        await db('documents').where('id', m.id).update({ landlord_visible: visible });
        changed += 1;
      }
      continue;
    }
    const scope = propertyOf.has(d.property_id) ? 'property' : landlordOf.has(d.landlord_id) ? 'landlord' : null;
    if (!scope) continue;
    const ownerId = scope === 'property' ? propertyOf.get(d.property_id) : landlordOf.get(d.landlord_id);
    const name = d.original_name || `document-${d.id}`;
    const [id] = await db('documents').insert({
      folder_id: await folderFor(scope),
      owner_type: scope,
      owner_id: ownerId,
      doc_type: DOC_TYPES[scope],
      filename: name.slice(0, 255),
      original_name: name.slice(0, 255),
      mime_type: MIME[path.extname(name).toLowerCase()] || 'application/octet-stream',
      file_path: `${ESTATES_FILE}doc`,
      file_size_bytes: d.file_size || null,
      uploaded_by: null,
      doc_reference: `TEMP-EST-${d.id}`,
      rocaem_document_id: d.id,
      landlord_visible: visible,
      created_at: d.created_at || db.fn.now()
    });
    await db('documents').where('id', id).update({ doc_reference: `REM-DOC-${String(id).padStart(5, '0')}` });
    changed += 1;
  }

  // Deleted in ROCA Estates → deleted here.
  const seen = new Set(emDocs.map((d) => d.id));
  const unseen = mirrors.filter((m) => !seen.has(m.rocaem_document_id)).map((m) => m.rocaem_document_id);
  if (unseen.length) {
    const still = new Set(await emDb('documents').whereIn('id', unseen).pluck('id'));
    for (const m of mirrors) {
      if (seen.has(m.rocaem_document_id) || still.has(m.rocaem_document_id)) continue;
      await db('documents').where('id', m.id).delete();
      removeLocalFile(m.file_path);
      changed += 1;
    }
  }
  return changed;
};

// One pull of everything, shared by everyone asking at the same time and
// skipped when the last one ran under THROTTLE_MS ago.
const THROTTLE_MS = 5000;
let lastRun = 0;
let running = null;

export const syncFromEstates = ({ force = false } = {}) => {
  // A forced pull (right after a write) must not reuse one that started before it.
  if (running) return force ? running.then(() => syncFromEstates({ force: true })) : running;
  if (!force && Date.now() - lastRun < THROTTLE_MS) return Promise.resolve();
  lastRun = Date.now();
  running = (async () => {
    // Nothing is pulled until Roca Living can write to ROCA Estates (the key is
    // set): until then Roca Living keeps its own copies, as before.
    if (!estatesApiReady()) return;
    const steps = [['landlords', pullLandlords], ['apartments', pullProperties], ['certificates', pullCertificates], ['documents', pullDocuments]];
    for (const [name, step] of steps) {
      try {
        const n = await step();
        if (n) logger.info(`[EstatesSync] ${n} ${name} updated from ROCA Estates`);
      } catch (err) {
        logger.warn(`[EstatesSync] ${name} not pulled: ${err.message}`);
      }
    }
  })().finally(() => { running = null; });
  return running;
};

// Before a page reads landlords, apartments, certificates or documents. Never
// holds a request for long: if ROCA Estates is slow the page shows what it has.
export const pullFromEstatesOnRead = (req, res, next) => {
  if (req.method !== 'GET') return next();
  let done = false;
  const go = () => { if (!done) { done = true; next(); } };
  setTimeout(go, 3000);
  syncFromEstates().then(go, go);
};
