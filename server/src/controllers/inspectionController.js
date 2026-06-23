import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

const VALID_RATINGS = ['excellent', 'good', 'satisfactory', 'unsatisfactory'];

const formatInspection = (i) => {
  if (!i) return null;
  return {
    ...i,
    inspected_at: i.inspected_at ? new Date(i.inspected_at).toISOString() : null,
    next_inspection_due: i.next_inspection_due ? new Date(i.next_inspection_due).toISOString().split('T')[0] : null,
    created_at: i.created_at ? new Date(i.created_at).toISOString() : null
  };
};

export const createInspection = catchAsync(async (req, res, next) => {
  const {
    property_id,
    tenancy_id,
    inspected_by,
    inspected_at,
    next_inspection_due,
    rating,
    notes,
    document_id
  } = req.body;

  if (!property_id || !inspected_at) {
    throw new ApiError(400, 'property_id and inspected_at are required');
  }

  // Verify property
  const property = await db('properties').where('id', property_id).first();
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  // Verify tenancy if provided
  if (tenancy_id) {
    const tenancy = await db('tenancies').where('id', tenancy_id).first();
    if (!tenancy) {
      throw new ApiError(404, 'Tenancy not found');
    }
  }

  // Verify document if provided
  if (document_id) {
    const doc = await db('documents').where('id', document_id).first();
    if (!doc) {
      throw new ApiError(404, 'Document not found');
    }
  }

  if (rating && !VALID_RATINGS.includes(rating)) {
    throw new ApiError(400, `Invalid rating. Must be one of: ${VALID_RATINGS.join(', ')}`);
  }

  const result = await db.transaction(async (trx) => {
    const [inspectionId] = await trx('inspections').insert({
      property_id,
      tenancy_id: tenancy_id || null,
      inspected_by: inspected_by || null,
      inspected_at: new Date(inspected_at),
      next_inspection_due: next_inspection_due || null,
      rating: rating || null,
      notes: notes || null,
      document_id: document_id || null,
      created_by: req.user.id
    });

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'PROPERTY_INSPECTION_CREATED',
      entity_type: 'inspection',
      entity_id: inspectionId,
      meta: JSON.stringify({ property_id, rating, inspected_at }),
      ip_address: req.ip || null
    });

    const insp = await trx('inspections').where('id', inspectionId).first();
    return formatInspection(insp);
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

export const getInspections = catchAsync(async (req, res, next) => {
  const { property_id, tenancy_id, rating } = req.query;

  let query = db('inspections')
    .join('properties', 'inspections.property_id', 'properties.id')
    .leftJoin('tenancies', 'inspections.tenancy_id', 'tenancies.id')
    .leftJoin('documents', 'inspections.document_id', 'documents.id')
    .select(
      'inspections.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'documents.filename as document_name',
      'documents.file_path as document_path'
    );

  if (property_id) query.where('inspections.property_id', property_id);
  if (tenancy_id) query.where('inspections.tenancy_id', tenancy_id);
  if (rating) query.where('inspections.rating', rating);

  const list = await query.orderBy('inspections.inspected_at', 'desc');

  res.json({
    success: true,
    data: list.map(i => ({
      ...formatInspection(i),
      address_line1: i.address_line1,
      city: i.city,
      postcode: i.postcode,
      document_name: i.document_name,
      document_path: i.document_path
    }))
  });
});

export const getMyInspections = catchAsync(async (req, res, next) => {
  const { property_id, rating } = req.query;

  let query = db('inspections')
    .join('properties', 'inspections.property_id', 'properties.id')
    .leftJoin('tenancies', 'inspections.tenancy_id', 'tenancies.id')
    .leftJoin('documents', 'inspections.document_id', 'documents.id')
    .select(
      'inspections.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'documents.filename as document_name',
      'documents.file_path as document_path'
    )
    .where('properties.landlord_id', req.user.id);

  if (property_id) query.where('inspections.property_id', property_id);
  if (rating) query.where('inspections.rating', rating);

  const list = await query.orderBy('inspections.inspected_at', 'desc');

  res.json({
    success: true,
    data: list.map(i => ({
      ...formatInspection(i),
      address_line1: i.address_line1,
      city: i.city,
      postcode: i.postcode,
      document_name: i.document_name,
      document_path: i.document_path
    }))
  });
});
