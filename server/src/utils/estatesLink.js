import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { emDb } from '../config/db.js';
import { ApiError } from './ApiError.js';
import { ensureLandlordSetup } from './landlordSetup.js';
import { getNumericSetting } from './settings.js';

// Link between ROCA Estates (rocaem) and Roca Living.
//
// Blocks, apartments and landlords are managed only in ROCA Estates. Roca
// Living's tenants, rent and statements still need a local property and
// landlord row to point at (foreign keys), so this module keeps one small
// internal record per Rocaem apartment / landlord, created automatically the
// first time a tenant is added. Admins never create or edit these by hand;
// display data (names, addresses) is read live from Rocaem.

export const unitKey = (block, apt) => (block && apt ? `${String(block).trim().toUpperCase()}|${String(apt).trim().toUpperCase()}` : null);

// Block code + apartment number of a Rocaem unit: PH + 33 (block short code +
// unit number, else unit_id "PH_33").
export const estateUnitCodes = (u) => {
  let block = u.building_short_code || null;
  let apt = u.unit_number || null;
  if ((!block || !apt) && u.unit_id && /^[A-Za-z0-9]+_[A-Za-z0-9]+$/.test(u.unit_id)) {
    const [b, a] = u.unit_id.split('_');
    block = block || b;
    apt = apt || a;
  }
  return {
    block: block ? String(block).trim().toUpperCase() : null,
    apt: apt ? String(apt).trim().toUpperCase() : null
  };
};

// Rocaem unit with its block and landlord id (whitelisted columns only).
export const fetchEstateUnit = (rocaemPropertyId) => emDb('properties as p')
  .leftJoin('buildings as b', 'p.building_id', 'b.id')
  .where('p.id', rocaemPropertyId)
  .select('p.id', 'p.name', 'p.unit_code', 'p.unit_id', 'p.unit_number', 'p.landlord_id', 'p.address', 'p.city', 'p.postcode',
    'b.name as building_name', 'b.short_code as building_short_code', 'b.address as building_address',
    'b.city as building_city', 'b.postcode as building_postcode')
  .first();

export const fetchEstateLandlord = (rocaemUserId) => emDb('users')
  .where({ id: rocaemUserId, role: 'LANDLORD' })
  .select('id', 'name', 'email', 'phone', 'address', 'city', 'postcode', 'country', 'ownership_type', 'company_name',
    'company_address', 'company_city', 'company_postcode', 'is_joint_ownership', 'secondary_owner_name')
  .first();

// "A & B" for joint owners (unless the name already includes the second owner).
export const estateLandlordName = (l) => {
  const main = l.ownership_type === 'COMPANY' && l.company_name ? l.company_name : l.name;
  const second = l.is_joint_ownership && l.secondary_owner_name && !String(main).includes(l.secondary_owner_name)
    ? l.secondary_owner_name : null;
  return second ? `${main} & ${second}` : main;
};

// Address as separate lines (the statement prints one line per row).
export const estateLandlordAddress = (l) => {
  const lines = l.ownership_type === 'COMPANY' && l.company_address
    ? [l.company_address, l.company_city, l.company_postcode]
    : [l.address, l.city, l.postcode, l.country];
  return lines.map((x) => (x ? String(x).trim() : '')).filter(Boolean).join('\n');
};

export const estateUnitAddress = (u) => {
  const { apt } = estateUnitCodes(u);
  const street = u.address || (u.building_name ? `${apt ? `Apartment ${apt}, ` : ''}${u.building_name}` : u.name);
  return {
    address_line1: street || u.name || 'Apartment',
    address_line2: u.address ? null : (u.building_address || null),
    city: u.city || u.building_city || '',
    postcode: u.postcode || u.building_postcode || ''
  };
};

// Local landlord record for a Rocaem landlord: by link, else same email, else
// created (internal only: random unusable password, no login link).
export const ensureLivingLandlord = async (trx, rocaemUserId) => {
  const linked = await trx('users').where({ rocaem_user_id: rocaemUserId }).first();
  if (linked) return linked.id;

  const l = await fetchEstateLandlord(rocaemUserId);
  if (!l) throw new ApiError(400, 'Landlord not found in ROCA Estates');
  if (!l.email) throw new ApiError(400, `Landlord ${l.name} has no email in ROCA Estates — add it there first`);

  const byEmail = await trx('users').whereRaw('LOWER(email) = ?', [l.email.toLowerCase()]).first();
  if (byEmail) {
    if (byEmail.role !== 'LANDLORD') throw new ApiError(409, `${l.email} is already used by a non-landlord account`);
    await trx('users').where('id', byEmail.id).update({ rocaem_user_id: rocaemUserId });
    return byEmail.id;
  }

  const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
  const [userId] = await trx('users').insert({
    name: estateLandlordName(l),
    email: l.email.toLowerCase(),
    phone: l.phone || '',
    address: estateLandlordAddress(l) || null,
    password,
    role: 'LANDLORD',
    rocaem_user_id: rocaemUserId
  });
  await ensureLandlordSetup(trx, userId, {});
  return userId;
};

// Landlord chosen in Roca Living when ROCA Estates has no owner on the unit:
// an existing Roca Living landlord, or a new one (reused if the email exists).
const resolveChosenLandlord = async (trx, { landlordId, newLandlord } = {}) => {
  if (landlordId) {
    const l = await trx('users').where({ id: landlordId, role: 'LANDLORD' }).first();
    if (!l) throw new ApiError(400, 'Selected landlord not found');
    return l.id;
  }
  if (newLandlord && newLandlord.name && newLandlord.email) {
    const email = String(newLandlord.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Enter a valid landlord email');
    const existing = await trx('users').whereRaw('LOWER(email) = ?', [email]).first();
    if (existing) {
      if (existing.role !== 'LANDLORD') throw new ApiError(409, `${email} is already used by a non-landlord account`);
      return existing.id;
    }
    const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
    const [userId] = await trx('users').insert({
      name: String(newLandlord.name).trim().slice(0, 255),
      email,
      phone: String(newLandlord.phone || '').trim().slice(0, 20),
      address: String(newLandlord.address || '').trim() || null,
      password,
      role: 'LANDLORD'
    });
    await ensureLandlordSetup(trx, userId, {});
    return userId;
  }
  return null;
};

// Local lettings record for a Rocaem apartment: by link, else same block +
// apartment number (existing records), else created. The landlord is the
// Rocaem owner; if Rocaem has none, the one chosen in Add Tenant.
export const ensureLivingProperty = async (trx, rocaemPropertyId, landlordChoice = {}) => {
  const linked = await trx('properties').where({ rocaem_property_id: rocaemPropertyId }).first();
  if (linked) return linked.id;

  const u = await fetchEstateUnit(rocaemPropertyId);
  if (!u) throw new ApiError(404, 'Apartment not found in ROCA Estates');
  const { block, apt } = estateUnitCodes(u);

  if (block && apt) {
    const byCode = await trx('properties')
      .whereNull('rocaem_property_id')
      .whereRaw('UPPER(block_name) = ? AND UPPER(apartment_number) = ?', [block, apt])
      .first();
    if (byCode) {
      await trx('properties').where('id', byCode.id).update({ rocaem_property_id: rocaemPropertyId });
      return byCode.id;
    }
  }

  const landlordId = u.landlord_id
    ? await ensureLivingLandlord(trx, u.landlord_id)
    : await resolveChosenLandlord(trx, landlordChoice);
  if (!landlordId) {
    throw new ApiError(400, `${u.name} has no landlord in ROCA Estates — choose or add the landlord`);
  }
  const addr = estateUnitAddress(u);
  const [propertyId] = await trx('properties').insert({
    landlord_id: landlordId,
    ...addr,
    name: u.name,
    block_name: block,
    apartment_number: apt,
    mgmt_fee_pct: await getNumericSetting('agencyFee', 8),
    status: 'vacant',
    property_reference: `TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    rocaem_property_id: rocaemPropertyId
  });
  await trx('properties').where('id', propertyId).update({ property_reference: `REM-PRP-${String(propertyId).padStart(5, '0')}` });
  return propertyId;
};

// "Refresh from ROCA Estates": copy the apartment address (when Rocaem has a
// complete one) and the owner's name/address onto the Roca Living records.
export const refreshFromEstates = async (trx, propertyId) => {
  const p = await trx('properties').where('id', propertyId).first();
  if (!p) throw new ApiError(404, 'Property not found');
  if (!p.rocaem_property_id) throw new ApiError(400, 'This property is not linked to a ROCA Estates apartment');
  const u = await fetchEstateUnit(p.rocaem_property_id);
  if (!u) throw new ApiError(404, 'Apartment not found in ROCA Estates');
  const updated = [];
  const addr = estateUnitAddress(u);
  if (addr.postcode) {
    await trx('properties').where('id', p.id).update({ ...addr, updated_at: trx.fn.now() });
    updated.push('apartment address');
  }
  if (u.landlord_id) {
    const l = await fetchEstateLandlord(u.landlord_id);
    if (l) {
      const address = estateLandlordAddress(l);
      await trx('users').where('id', p.landlord_id).update({
        name: estateLandlordName(l),
        ...(address ? { address } : {}),
        ...(l.phone ? { phone: l.phone } : {})
      });
      updated.push('landlord name and address');
    }
  }
  return updated;
};

// Live Rocaem display data for a local property, used on statements. Returns
// null values where Rocaem has nothing, so callers fall back to local data.
export const estateDisplayFor = async (rocaemPropertyId) => {
  if (!rocaemPropertyId) return null;
  try {
    const u = await fetchEstateUnit(rocaemPropertyId);
    if (!u) return null;
    const l = u.landlord_id ? await fetchEstateLandlord(u.landlord_id) : null;
    const addr = estateUnitAddress(u);
    const codes = estateUnitCodes(u);
    return {
      block: codes.block,
      apt: codes.apt,
      // Only a complete address (with postcode) replaces the local one.
      property_address: addr.postcode ? [addr.address_line1, addr.address_line2, addr.city, addr.postcode].filter(Boolean).join(', ') : null,
      landlord_name: l ? estateLandlordName(l) : null,
      landlord_address: l ? estateLandlordAddress(l) : null
    };
  } catch {
    return null; // Rocaem unreachable: statements fall back to the local record.
  }
};

