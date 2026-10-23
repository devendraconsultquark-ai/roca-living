import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { estatesApi, estatesApiReady, estatesUpload, estatesStream } from '../utils/estatesApi.js';
import { ensureLivingLandlord, fetchEstateLandlord, estateLandlordName, estateLandlordAddress } from '../utils/estatesLink.js';
import { eraseLandlordData } from './landlordController.js';
import { deletePropertyInternal } from './propertyController.js';
import { syncFromEstates, estatesOwnerDiffers } from '../utils/estatesSync.js';

// Add, change and delete ROCA Estates landlords and apartments from Roca
// Living (client decision 21 Oct). ROCA Estates stays the only copy: every
// change is sent to its own API (utils/estatesApi.js), which applies its rules
// and codes and keeps a change log. Roca Living adds what ROCA Estates cannot
// know: its lettings history blocks a delete, and its own records follow.

// What Roca Living may send: everything the ROCA Estates admin forms edit,
// except service charge, which Roca Living does not deal in (RL-033).
const LANDLORD_FIELDS = [
  'name', 'first_name', 'middle_name', 'last_name', 'email', 'phone',
  'address', 'city', 'country', 'postcode',
  'ownership_type', 'company_name', 'company_reg_no', 'company_number',
  'company_address', 'company_city', 'company_postcode', 'contact_person',
  'is_joint_ownership', 'secondary_owner_name', 'secondary_first_name', 'secondary_middle_name', 'secondary_last_name',
  'secondary_owner_phone', 'secondary_owner_email', 'secondary_owner_address', 'secondary_owner_city',
  'secondary_owner_postcode', 'secondary_owner_country',
  'nationality', 'residence_country', 'tax_residency', 'owner_dob', 'secondary_owner_dob', 'notes',
  'nrl_number', 'statement_initials', 'preferred_statement_email',
  'secondary_nrl_number', 'secondary_statement_initials',
  'legal_fee', 'sdlt'
];
const APARTMENT_FIELDS = [
  'landlord_id', 'name', 'address', 'city', 'postcode', 'unit_type', 'floor_number', 'internal_area',
  'has_parking', 'parking_space', 'heating_type', 'tenure_type', 'status', 'ownership_structure',
  'lease_start_date', 'lease_end_date', 'lease_term_years', 'ground_rent_amount', 'land_registry_title_no',
  'subletting_allowed', 'pets_allowed',
  'epc_rating', 'epc_start_date', 'epc_expiry_date', 'eicr_status', 'eicr_start_date', 'eicr_expiry_date',
  'smoke_detector_date', 'smoke_detector_expiry_date', 'sprinkler_date', 'sprinkler_expiry_date',
  'gas_safety_date', 'gas_safety_expiry_date', 'hmo_licence_date', 'hmo_licence_expiry_date', 'pat_date', 'pat_expiry_date',
  'repair_obligations', 'purchase_price', 'purchase_date', 'ground_rent_review_terms'
];
// Files kept on the ROCA Estates apartment (one each).
export const APARTMENT_FILES = [
  'floor_plan', 'epc_file', 'eicr_file', 'smoke_detector_file', 'sprinkler_file',
  'gas_safety_file', 'hmo_licence_file', 'pat_file', 'lease_file', 'title_register_file'
];
// Block and unit number are set once, when the apartment is added: they make
// the unit code (PH_08) that statement numbers are built from.
const NEW_APARTMENT_FIELDS = [...APARTMENT_FIELDS, 'building_id', 'unit_number'];

const pick = (body, fields) => Object.fromEntries(fields.filter((f) => body?.[f] !== undefined).map((f) => [f, body[f]]));

const rocaemId = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'Invalid ROCA Estates id');
  return id;
};

// Field names only in the audit trail, never their values.
const audit = (trx, req, action, entityType, entityId, meta) => trx('audit_log').insert({
  actor_id: req.user.id,
  actor_role: req.user.role,
  action,
  entity_type: entityType,
  entity_id: entityId,
  meta: JSON.stringify(meta),
  ip_address: req.ip || null
});

const count = async (query) => Number((await query.count('* as n').first()).n);

// Roca Living history that must not disappear with a ROCA Estates record.
const blockedBy = (parts) => {
  const found = parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  return found.length ? found.join(', ') : null;
};

// GET /estates/edit-status — whether the add/edit/delete screens can be offered.
export const getEstatesEditStatus = (req, res) => {
  res.json({ success: true, data: { enabled: estatesApiReady() } });
};

// ── Landlords ────────────────────────────────────────────────────────────────

// POST /estates/landlords
export const createEstateLandlord = catchAsync(async (req, res) => {
  const body = pick(req.body, LANDLORD_FIELDS);
  const data = await estatesApi('POST', '/users', { body, actingFor: req.user.email });
  const landlord = data?.landlord;
  await audit(db, req, 'ESTATE_LANDLORD_CREATED', 'estates_landlord', landlord?.id || null, { fields: Object.keys(body) });
  res.status(201).json({ success: true, message: 'Landlord added in ROCA Estates', data: { id: landlord?.id } });
});

// PATCH /estates/landlords/:id
export const updateEstateLandlord = catchAsync(async (req, res) => {
  const id = rocaemId(req);
  const body = pick(req.body, LANDLORD_FIELDS);
  if (!Object.keys(body).length) throw new ApiError(400, 'Nothing to change');
  await estatesApi('PATCH', `/users/${id}`, { body, actingFor: req.user.email });

  // Keep Roca Living's copy of a linked landlord (lists, fallbacks) in step.
  const linked = await db('users').where({ rocaem_user_id: id, role: 'LANDLORD' }).first();
  const fresh = linked ? await fetchEstateLandlord(id) : null;
  await db.transaction(async (trx) => {
    if (linked && fresh) {
      const update = { name: estateLandlordName(fresh), phone: fresh.phone || '', address: estateLandlordAddress(fresh) || null };
      const email = fresh.email ? fresh.email.toLowerCase() : null;
      if (email && email !== linked.email) {
        const taken = await trx('users').whereRaw('LOWER(email) = ?', [email]).whereNot('id', linked.id).first('id');
        if (!taken) update.email = email;
      }
      await trx('users').where('id', linked.id).update(update);
    }
    await audit(trx, req, 'ESTATE_LANDLORD_UPDATED', 'estates_landlord', id, { fields: Object.keys(body) });
  });
  await syncFromEstates({ force: true });
  res.json({ success: true, message: 'Landlord updated in ROCA Estates' });
});

// DELETE /estates/landlords/:id
export const deleteEstateLandlord = catchAsync(async (req, res) => {
  const id = rocaemId(req);
  const linked = await db('users').where({ rocaem_user_id: id, role: 'LANDLORD' }).first();
  if (linked) {
    const reason = blockedBy([
      [await count(db('properties').where('landlord_id', linked.id)), 'Roca Living apartment record(s)'],
      [await count(db('landlord_statements').where('landlord_id', linked.id)), 'statement(s)'],
      [await count(db('transactions').where('landlord_id', linked.id)), 'payment record(s)'],
      [await count(db('documents').where({ owner_type: 'landlord', owner_id: linked.id }).whereNull('rocaem_document_id')), 'document(s)']
    ]);
    if (reason) throw new ApiError(409, `This landlord has ${reason} in Roca Living and cannot be deleted.`);
  }

  await estatesApi('DELETE', `/users/${id}`, { actingFor: req.user.email });

  await db.transaction(async (trx) => {
    if (linked) await eraseLandlordData(trx, linked.id, { id: req.user.id, role: req.user.role, ip: req.ip });
    await audit(trx, req, 'ESTATE_LANDLORD_DELETED', 'estates_landlord', id, { roca_living_landlord_id: linked?.id || null });
  });
  res.json({ success: true, message: 'Landlord deleted' });
});

// ── Apartments ───────────────────────────────────────────────────────────────

// POST /estates/properties
export const createEstateApartment = catchAsync(async (req, res) => {
  const body = pick(req.body, NEW_APARTMENT_FIELDS);
  const data = await estatesApi('POST', '/properties', { body, actingFor: req.user.email });
  const unit = data?.property;
  await audit(db, req, 'ESTATE_APARTMENT_CREATED', 'estates_apartment', unit?.id || null, { fields: Object.keys(body) });
  await syncFromEstates({ force: true });
  res.status(201).json({ success: true, message: 'Apartment added in ROCA Estates', data: { id: unit?.id } });
});

// PATCH /estates/properties/:id  { …fields, confirm_owner_change? }
// A new owner on a managed apartment also moves Roca Living's lettings record
// to that owner; statements already made keep their landlord.
export const updateEstateApartment = catchAsync(async (req, res) => {
  const id = rocaemId(req);
  const body = pick(req.body, APARTMENT_FIELDS);
  if (!Object.keys(body).length) throw new ApiError(400, 'Nothing to change');
  const linked = await db('properties').where({ rocaem_property_id: id }).first();
  const ownerChange = linked && 'landlord_id' in body;

  await db.transaction(async (trx) => {
    let livingLandlordId = null;
    if (ownerChange) {
      if (!body.landlord_id) throw new ApiError(400, 'A Roca Living apartment needs a landlord. Choose the new owner instead.');
      livingLandlordId = await ensureLivingLandlord(trx, Number(body.landlord_id));
      if (livingLandlordId !== linked.landlord_id && !req.body.confirm_owner_change) {
        const current = await trx('tenancies').where('property_id', linked.id).whereIn('status', ['active', 'notice', 'pending']).first('id');
        if (current) {
          throw new ApiError(409, 'This apartment has a current tenancy. Confirm the change of owner: future statements will go to the new owner.');
        }
      }
    }

    await estatesApi('PATCH', `/properties/${id}`, { body, actingFor: req.user.email });

    if (ownerChange && livingLandlordId !== linked.landlord_id) {
      await trx('properties').where('id', linked.id).update({ landlord_id: livingLandlordId, updated_at: trx.fn.now() });
    }
    await audit(trx, req, 'ESTATE_APARTMENT_UPDATED', 'estates_apartment', id, {
      fields: Object.keys(body),
      ...(ownerChange && livingLandlordId !== linked.landlord_id ? { property_id: linked.id, landlord_from: linked.landlord_id, landlord_to: livingLandlordId } : {})
    });
  });
  await syncFromEstates({ force: true });
  res.json({ success: true, message: 'Apartment updated in ROCA Estates' });
});

// POST /estates/properties/:id/accept-owner  { confirm_owner_change }
// ROCA Estates has another owner for a managed flat (changed there): move the
// Roca Living flat to that owner, so its future statements and Xero landlord
// bills go to them. Statements already made keep their landlord.
export const acceptEstateOwner = catchAsync(async (req, res) => {
  const id = rocaemId(req);
  const linked = await db('properties').where({ rocaem_property_id: id }).first();
  if (!linked) throw new ApiError(404, 'This apartment is not managed in Roca Living');
  const owner = await estatesOwnerDiffers(linked);
  if (!owner) return res.json({ success: true, message: 'The owner is already the same in both apps' });
  await db.transaction(async (trx) => {
    const livingLandlordId = await ensureLivingLandlord(trx, owner.rocaem_id);
    if (!req.body?.confirm_owner_change) {
      const current = await trx('tenancies').where('property_id', linked.id).whereIn('status', ['active', 'notice', 'pending']).first('id');
      if (current) throw new ApiError(409, 'This apartment has a current tenancy. Confirm the change of owner: future statements and Xero bills will go to the new owner.');
    }
    await trx('properties').where('id', linked.id).update({ landlord_id: livingLandlordId, updated_at: trx.fn.now() });
    await audit(trx, req, 'ESTATE_OWNER_ACCEPTED', 'property', linked.id, { landlord_from: linked.landlord_id, landlord_to: livingLandlordId, rocaem_landlord_id: owner.rocaem_id });
  });
  res.json({ success: true, message: `Owner changed to ${owner.name}` });
});

const apartmentFile = (req) => {
  const field = String(req.params.field || '');
  if (!APARTMENT_FILES.includes(field)) throw new ApiError(400, 'Unknown apartment file');
  return field;
};

// PUT /estates/properties/:id/files/:field  (multipart "file") — replaces that file in ROCA Estates.
export const uploadEstateApartmentFile = catchAsync(async (req, res) => {
  const id = rocaemId(req);
  const field = apartmentFile(req);
  if (!req.file) throw new ApiError(400, 'No file uploaded');
  const data = await estatesUpload('PATCH', `/properties/${id}`, {
    files: [{ field, buffer: req.file.buffer, name: req.file.originalname, type: req.file.mimetype }],
    actingFor: req.user.email
  });
  await audit(db, req, 'ESTATE_APARTMENT_FILE_UPLOADED', 'estates_apartment', id, { field, original_name: req.file.originalname });
  await syncFromEstates({ force: true });
  res.json({ success: true, message: 'File saved in ROCA Estates', data: { [field]: data?.property?.[field] || null } });
});

// DELETE /estates/properties/:id/files/:field
export const removeEstateApartmentFile = catchAsync(async (req, res) => {
  const id = rocaemId(req);
  const field = apartmentFile(req);
  await estatesApi('PATCH', `/properties/${id}`, { body: { [field]: '' }, actingFor: req.user.email });
  await audit(db, req, 'ESTATE_APARTMENT_FILE_REMOVED', 'estates_apartment', id, { field });
  await syncFromEstates({ force: true });
  res.json({ success: true, message: 'File removed in ROCA Estates' });
});

// GET /estates/properties/:id/files/:field[?download=1] — the file, from ROCA Estates.
export const getEstateApartmentFile = catchAsync(async (req, res) => {
  const id = rocaemId(req);
  const field = apartmentFile(req);
  await estatesStream(`/files/preview/apartment/${id}?field=${field}`, res, { download: req.query.download === '1' });
});

// DELETE /estates/properties/:id
export const deleteEstateApartment = catchAsync(async (req, res) => {
  const id = rocaemId(req);
  const linked = await db('properties').where({ rocaem_property_id: id }).first();
  if (linked) {
    const reason = blockedBy([
      [await count(db('tenancies').where('property_id', linked.id)), 'tenancy record(s)'],
      [await count(db('property_expenses').where('property_id', linked.id)), 'expense(s)'],
      [await count(db('maintenance_tickets').where('property_id', linked.id)), 'maintenance ticket(s)'],
      [await count(db('inspections').where('property_id', linked.id)), 'inspection(s)'],
      [await count(db('documents').where({ owner_type: 'property', owner_id: linked.id }).whereNull('rocaem_document_id')), 'document(s)'],
      [await count(db('property_images').where('property_id', linked.id).whereNull('estates_file')), 'photo(s)'],
      [await count(db('transactions').where('property_id', linked.id)), 'payment record(s)']
    ]);
    if (reason) throw new ApiError(409, `This apartment has ${reason} in Roca Living and cannot be deleted.`);
  }

  await estatesApi('DELETE', `/properties/${id}`, { actingFor: req.user.email });

  await db.transaction(async (trx) => {
    if (linked) await deletePropertyInternal(trx, linked.id);
    await audit(trx, req, 'ESTATE_APARTMENT_DELETED', 'estates_apartment', id, { roca_living_property_id: linked?.id || null });
  });
  res.json({ success: true, message: 'Apartment deleted' });
});
