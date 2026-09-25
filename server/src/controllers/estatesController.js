import db, { emDb } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { estateUnitCodes, unitKey } from '../utils/estatesLink.js';

// ROCA Estates (rocaem) data shown read-only in Roca Living.
// ROCA is one company with two services: ROCA Estates (block management) owns
// blocks, apartments and landlords; Roca Living (lettings) only adds tenants,
// rent and statements. Nothing here writes to rocaem, and rocaem data is not
// copied: it is read live. Roca Living's own lettings records are matched on
// the fly — apartments by block code + apartment number (PH + 33), landlords
// by email.

// Only these columns ever leave rocaem (never passwords, OTPs, reset tokens…).
const UNIT_LIST_COLUMNS = [
  'p.id', 'p.unit_code', 'p.unit_id', 'p.unit_number', 'p.name', 'p.building_id', 'p.landlord_id',
  'p.unit_type', 'p.floor_number', 'p.status', 'p.tenure_type', 'p.service_charge_pcm', 'p.property_reference'
];
const UNIT_DETAIL_COLUMNS = [
  ...UNIT_LIST_COLUMNS,
  'p.address', 'p.city', 'p.postcode', 'p.internal_area', 'p.has_parking', 'p.parking_space', 'p.heating_type',
  'p.ownership_structure', 'p.purchase_price', 'p.purchase_date', 'p.land_registry_title_no',
  'p.lease_start_date', 'p.lease_end_date', 'p.lease_term_years', 'p.ground_rent_amount', 'p.ground_rent_review_terms',
  'p.service_charge_pa', 'p.service_charge_percentage', 'p.apportionment_method', 'p.subletting_allowed', 'p.pets_allowed',
  'p.epc_rating', 'p.epc_start_date', 'p.epc_expiry_date', 'p.eicr_start_date', 'p.eicr_expiry_date', 'p.eicr_status',
  'p.smoke_detector_date', 'p.sprinkler_date'
];
const LANDLORD_LIST_COLUMNS = [
  'u.id', 'u.name', 'u.email', 'u.phone', 'u.status', 'u.ownership_type', 'u.company_name',
  'u.is_joint_ownership', 'u.secondary_owner_name', 'u.country', 'u.residence_country'
];
const LANDLORD_DETAIL_COLUMNS = [
  ...LANDLORD_LIST_COLUMNS,
  'u.address', 'u.city', 'u.postcode', 'u.contact_person', 'u.company_reg_no', 'u.company_number',
  'u.company_address', 'u.company_city', 'u.company_postcode',
  'u.secondary_owner_phone', 'u.secondary_owner_email', 'u.secondary_owner_address', 'u.secondary_owner_city',
  'u.secondary_owner_postcode', 'u.secondary_owner_country',
  'u.nationality', 'u.tax_residency', 'u.payment_ref', 'u.hmrc_verified',
  'u.aml_risk_rating', 'u.aml_last_assessed', 'u.aml_next_review', 'u.notes'
];

// rocaem unavailable → a clear 503 instead of a generic 500.
const fromEstates = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    logger.error(`[Estates] ROCA Estates database query failed: ${err.message}`);
    throw new ApiError(503, 'ROCA Estates data is not available right now. Please try again shortly.');
  }
};

// Roca Living lettings records, keyed by their Rocaem link (and, for records
// not linked yet, by block|apartment).
const livingPropertiesByUnit = async () => {
  const rows = await db('properties')
    .leftJoin('tenancies', function () {
      this.on('tenancies.property_id', '=', 'properties.id').andOnIn('tenancies.status', ['active', 'notice']);
    })
    .where((w) => w.whereNotNull('properties.rocaem_property_id')
      .orWhere((x) => x.whereNotNull('properties.block_name').whereNotNull('properties.apartment_number')))
    .select('properties.id', 'properties.block_name', 'properties.apartment_number', 'properties.rent_pcm',
      'properties.rocaem_property_id', 'tenancies.id as tenancy_id');
  const byRocaem = new Map();
  const byKey = new Map();
  for (const r of rows) {
    const link = { property_id: r.id, rent_pcm: r.rent_pcm, has_tenant: !!r.tenancy_id };
    if (r.rocaem_property_id) {
      if (!byRocaem.has(r.rocaem_property_id) || link.has_tenant) byRocaem.set(r.rocaem_property_id, link);
    } else {
      const key = unitKey(r.block_name, r.apartment_number);
      if (key && !byKey.has(key)) byKey.set(key, link);
    }
  }
  return { byRocaem, byKey };
};

// Roca Living landlord record for a Rocaem landlord: by link, else by email.
const livingLandlordFinder = async () => {
  const rows = await db('users').where('role', 'LANDLORD').select('id', 'email', 'rocaem_user_id');
  const byRocaem = new Map(rows.filter((r) => r.rocaem_user_id).map((r) => [r.rocaem_user_id, r.id]));
  const byEmail = new Map(rows.filter((r) => r.email && !r.rocaem_user_id).map((r) => [r.email.toLowerCase(), r.id]));
  return (l) => byRocaem.get(l.id) || (l.email ? byEmail.get(l.email.toLowerCase()) : null) || null;
};

const toUnit = (u, living) => {
  const { block, apt } = estateUnitCodes(u);
  const link = living.byRocaem.get(u.id) || living.byKey.get(unitKey(block, apt)) || null;
  return {
    ...u,
    block_code: block,
    apartment_number: apt,
    unit_ref: block && apt ? `${block}-${apt}` : u.unit_code,
    roca_living: link
  };
};

const unitsQuery = () => emDb('properties as p')
  .leftJoin('buildings as b', 'p.building_id', 'b.id')
  .leftJoin('users as u', 'p.landlord_id', 'u.id');

// GET /estates/buildings
export const getEstateBuildings = catchAsync(async (req, res) => {
  const rows = await fromEstates(() => emDb('buildings as b')
    .leftJoin('properties as p', 'p.building_id', 'b.id')
    .groupBy('b.id')
    .orderBy('b.name')
    .select('b.id', 'b.name', 'b.short_code', 'b.address', 'b.city', 'b.postcode', 'b.status',
      'b.number_of_apartments', 'b.management_type', emDb.raw('COUNT(p.id) as unit_count')));
  res.json({ success: true, data: rows.map((b) => ({ ...b, unit_count: Number(b.unit_count) })) });
});

// GET /estates/properties[?building_id=&search=]
export const getEstateProperties = catchAsync(async (req, res) => {
  const { building_id: buildingId, search } = req.query;
  const rows = await fromEstates(() => {
    const q = unitsQuery().select(
      ...UNIT_LIST_COLUMNS,
      'b.name as building_name', 'b.short_code as building_short_code',
      'u.name as landlord_name', 'u.email as landlord_email'
    );
    if (buildingId) q.where('p.building_id', buildingId);
    if (search) {
      const s = `%${String(search).trim()}%`;
      q.where((w) => w.where('p.name', 'like', s).orWhere('p.unit_code', 'like', s).orWhere('p.unit_id', 'like', s).orWhere('u.name', 'like', s));
    }
    return q.orderBy([{ column: 'b.name' }, { column: 'p.id' }]);
  });
  const living = await livingPropertiesByUnit();
  const data = rows.map((u) => toUnit(u, living));
  // Natural order within a block (unit 2 before unit 10); units without a block last.
  data.sort((a, b) => (!a.building_name) - (!b.building_name)
    || String(a.building_name || '').localeCompare(String(b.building_name || ''))
    || (parseInt(a.apartment_number, 10) || 0) - (parseInt(b.apartment_number, 10) || 0));
  res.json({ success: true, data });
});

// GET /estates/properties/:id
export const getEstateProperty = catchAsync(async (req, res) => {
  const row = await fromEstates(() => unitsQuery()
    .where('p.id', req.params.id)
    .select(
      ...UNIT_DETAIL_COLUMNS,
      'b.name as building_name', 'b.short_code as building_short_code', 'b.address as building_address',
      'b.city as building_city', 'b.postcode as building_postcode',
      'u.name as landlord_name', 'u.email as landlord_email', 'u.phone as landlord_phone'
    )
    .first());
  if (!row) throw new ApiError(404, 'Apartment not found in ROCA Estates');
  const living = await livingPropertiesByUnit();
  res.json({ success: true, data: toUnit(row, living) });
});

// GET /estates/landlords[?search=]
export const getEstateLandlords = catchAsync(async (req, res) => {
  const { search } = req.query;
  const [rows, units] = await fromEstates(async () => {
    const q = emDb('users as u').where('u.role', 'LANDLORD').select(...LANDLORD_LIST_COLUMNS).orderBy('u.name');
    if (search) {
      const s = `%${String(search).trim()}%`;
      q.where((w) => w.where('u.name', 'like', s).orWhere('u.email', 'like', s).orWhere('u.company_name', 'like', s));
    }
    const list = await q;
    const ids = list.map((l) => l.id);
    const owned = ids.length
      ? await emDb('properties as p').leftJoin('buildings as b', 'p.building_id', 'b.id')
        .whereIn('p.landlord_id', ids)
        .select('p.landlord_id', 'p.unit_code', 'p.unit_id', 'p.unit_number', 'b.short_code as building_short_code')
      : [];
    return [list, owned];
  });
  const findLiving = await livingLandlordFinder();
  const unitsBy = {};
  for (const u of units) {
    const { block, apt } = estateUnitCodes(u);
    (unitsBy[u.landlord_id] ||= []).push(block && apt ? `${block}-${apt}` : u.unit_code);
  }
  res.json({
    success: true,
    data: rows.map((l) => ({
      ...l,
      units: unitsBy[l.id] || [],
      roca_living_landlord_id: findLiving(l)
    }))
  });
});

// GET /estates/landlords/:id
export const getEstateLandlord = catchAsync(async (req, res) => {
  const [landlord, units] = await fromEstates(async () => {
    const l = await emDb('users as u').where({ 'u.id': req.params.id, 'u.role': 'LANDLORD' }).select(...LANDLORD_DETAIL_COLUMNS).first();
    if (!l) return [null, []];
    const owned = await unitsQuery().where('p.landlord_id', l.id)
      .select(...UNIT_LIST_COLUMNS, 'b.name as building_name', 'b.short_code as building_short_code');
    return [l, owned];
  });
  if (!landlord) throw new ApiError(404, 'Landlord not found in ROCA Estates');
  const living = await livingPropertiesByUnit();
  const findLiving = await livingLandlordFinder();
  res.json({
    success: true,
    data: {
      ...landlord,
      roca_living_landlord_id: findLiving(landlord),
      units: units.map((u) => toUnit(u, living))
    }
  });
});
