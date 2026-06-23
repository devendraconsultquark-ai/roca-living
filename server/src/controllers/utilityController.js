import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

const ALLOWED_UTILITY_FIELDS = [
  'supplier',
  'account_ref',
  'direction',
  'void_apportioned',
  'council_tax_notified',
  'meter_reading_in',
  'meter_reading_out',
  'handover_date',
  'status',
  'notes',
  'utility_type'
];

const formatUtility = (u) => {
  if (!u) return null;
  return {
    ...u,
    handover_date: u.handover_date ? new Date(u.handover_date).toISOString().split('T')[0] : null,
    created_at: u.created_at ? new Date(u.created_at).toISOString() : null,
    updated_at: u.updated_at ? new Date(u.updated_at).toISOString() : null
  };
};

export const getAllUtilities = catchAsync(async (req, res, next) => {
  const { property_id, tenancy_id, utility_type, status } = req.query;

  let query = db('utilities')
    .join('properties', 'utilities.property_id', 'properties.id')
    .leftJoin('tenancies', 'utilities.tenancy_id', 'tenancies.id')
    .select(
      'utilities.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode'
    );

  if (property_id) query.where('utilities.property_id', property_id);
  if (tenancy_id) query.where('utilities.tenancy_id', tenancy_id);
  if (utility_type) query.where('utilities.utility_type', utility_type);
  if (status) query.where('utilities.status', status);

  const list = await query.orderBy('utilities.created_at', 'desc');

  res.json({
    success: true,
    data: list.map(u => ({
      ...formatUtility(u),
      address_line1: u.address_line1,
      city: u.city,
      postcode: u.postcode
    }))
  });
});

export const createUtilityRecord = catchAsync(async (req, res, next) => {
  const {
    property_id,
    tenancy_id,
    utility_type,
    supplier,
    account_ref,
    direction,
    void_apportioned,
    council_tax_notified,
    meter_reading_in,
    meter_reading_out,
    handover_date,
    status,
    notes
  } = req.body;

  if (!property_id || !utility_type || !direction) {
    throw new ApiError(400, 'property_id, utility_type, and direction are required');
  }

  // Check if property exists
  const property = await db('properties').where('id', property_id).first();
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  if (tenancy_id) {
    const tenancy = await db('tenancies').where('id', tenancy_id).first();
    if (!tenancy) {
      throw new ApiError(404, 'Tenancy not found');
    }
  }

  const result = await db.transaction(async (trx) => {
    const [utilityId] = await trx('utilities').insert({
      property_id,
      tenancy_id: tenancy_id || null,
      utility_type,
      supplier: supplier || null,
      account_ref: account_ref || null,
      direction,
      void_apportioned: void_apportioned ? 1 : 0,
      council_tax_notified: council_tax_notified ? 1 : 0,
      meter_reading_in: meter_reading_in || null,
      meter_reading_out: meter_reading_out || null,
      handover_date: handover_date || null,
      status: status || 'pending',
      notes: notes || null
    });

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'UTILITY_RECORD_CREATED',
      entity_type: 'utility',
      entity_id: utilityId,
      meta: JSON.stringify({ property_id, utility_type, direction, status: status || 'pending' }),
      ip_address: req.ip || null
    });

    const record = await trx('utilities').where('id', utilityId).first();
    return formatUtility(record);
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

export const updateUtilityStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const record = await db('utilities').where('id', id).first();
  if (!record) {
    throw new ApiError(404, 'Utility record not found');
  }

  const updateData = {};
  ALLOWED_UTILITY_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  await db.transaction(async (trx) => {
    if (Object.keys(updateData).length > 0) {
      await trx('utilities')
        .where('id', id)
        .update({
          ...updateData,
          updated_at: trx.fn.now()
        });
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'UTILITY_RECORD_UPDATED',
      entity_type: 'utility',
      entity_id: id,
      meta: JSON.stringify(updateData),
      ip_address: req.ip || null
    });
  });

  const updatedRecord = await db('utilities').where('id', id).first();

  res.json({
    success: true,
    data: formatUtility(updatedRecord)
  });
});
