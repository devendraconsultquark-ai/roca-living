import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const ALLOWED_PROPERTY_FIELDS = [
  'address_line1',
  'address_line2',
  'city',
  'postcode',
  'property_type',
  'bedrooms',
  'rent_pcm',
  'mgmt_fee_pct',
  'key_ref',
  'notes',
  'status',
  'name',
  'property_reference'
];

const formatProperty = (p) => {
  if (!p) return null;
  return {
    ...p,
    rent_pcm: p.rent_pcm !== null && p.rent_pcm !== undefined ? parseFloat(p.rent_pcm).toFixed(2) : null,
    mgmt_fee_pct: p.mgmt_fee_pct !== null && p.mgmt_fee_pct !== undefined ? parseFloat(p.mgmt_fee_pct).toFixed(2) : null,
    created_at: p.created_at ? new Date(p.created_at).toISOString() : null,
    updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : null
  };
};

export const getAllProperties = catchAsync(async (req, res, next) => {
  const { landlord_id, status, search } = req.query;

  let query = db('properties')
    .join('users', 'properties.landlord_id', 'users.id')
    .select(
      'properties.*',
      'users.name as landlord_name',
      db.raw(`(SELECT status FROM property_certificates WHERE property_id = properties.id AND cert_type = 'GAS' LIMIT 1) as gasCompliance`),
      db.raw(`(SELECT status FROM property_certificates WHERE property_id = properties.id AND cert_type = 'EPC' LIMIT 1) as epcCompliance`)
    );

  if (landlord_id) {
    query.where('properties.landlord_id', landlord_id);
  }

  if (status) {
    query.where('properties.status', status);
  }

  if (search) {
    const searchPattern = `%${search}%`;
    query.where((qb) => {
      qb.where('properties.address_line1', 'like', searchPattern)
        .orWhere('properties.city', 'like', searchPattern)
        .orWhere('properties.postcode', 'like', searchPattern);
    });
  }

  const properties = await query;
  const formatted = properties.map(formatProperty);

  res.json({
    success: true,
    data: formatted
  });
});

export const getPropertyById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const property = await db('properties')
    .join('users', 'properties.landlord_id', 'users.id')
    .select('properties.*', 'users.name as landlord_name', 'users.email as landlord_email')
    .where('properties.id', id)
    .first();

  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  const certificates = await db('property_certificates').where('property_id', id);
  const formattedCerts = certificates.map((c) => ({
    ...c,
    issued_at: c.issued_at ? new Date(c.issued_at).toISOString().split('T')[0] : null,
    expires_at: c.expires_at ? new Date(c.expires_at).toISOString().split('T')[0] : null,
    created_at: c.created_at ? new Date(c.created_at).toISOString() : null,
    updated_at: c.updated_at ? new Date(c.updated_at).toISOString() : null
  }));

  const compliance = await db('compliance_checklist').where({ scope: 'property', entity_id: id });
  const formattedCompliance = compliance.map((c) => ({
    ...c,
    verified_at: c.verified_at ? new Date(c.verified_at).toISOString() : null,
    created_at: c.created_at ? new Date(c.created_at).toISOString() : null,
    updated_at: c.updated_at ? new Date(c.updated_at).toISOString() : null
  }));

  const formattedProperty = formatProperty(property);

  // Active tenancy with tenants and deposit
  const tenancy = await db('tenancies')
    .where({ property_id: id, status: 'active' })
    .orderBy('start_date', 'desc')
    .first();
  let tenancyData = null;
  if (tenancy) {
    const tenants = await db('tenants').where('tenancy_id', tenancy.id);
    const deposit = await db('deposits').where('tenancy_id', tenancy.id).first();
    tenancyData = {
      id: tenancy.id,
      status: tenancy.status,
      start_date: tenancy.start_date ? new Date(tenancy.start_date).toISOString().split('T')[0] : null,
      end_date: tenancy.end_date ? new Date(tenancy.end_date).toISOString().split('T')[0] : null,
      rent_pcm: tenancy.rent_pcm !== null ? parseFloat(tenancy.rent_pcm).toFixed(2) : null,
      tenants,
      deposit: deposit ? {
        ...deposit,
        tenancy_deposit: deposit.tenancy_deposit !== null ? parseFloat(deposit.tenancy_deposit).toFixed(2) : null,
        holding_deposit: deposit.holding_deposit !== null ? parseFloat(deposit.holding_deposit).toFixed(2) : null,
        received_at: deposit.received_at ? new Date(deposit.received_at).toISOString().split('T')[0] : null,
        registered_at: deposit.registered_at ? new Date(deposit.registered_at).toISOString().split('T')[0] : null,
      } : null
    };
  }

  // Recent maintenance tickets (last 5)
  const maintenanceTickets = await db('maintenance_tickets')
    .leftJoin('contractors', 'maintenance_tickets.contractor_id', 'contractors.id')
    .select('maintenance_tickets.*', 'contractors.company_name as contractor_name')
    .where('maintenance_tickets.property_id', id)
    .orderBy('maintenance_tickets.created_at', 'desc')
    .limit(5);

  res.json({
    success: true,
    data: {
      ...formattedProperty,
      property_certificates: formattedCerts,
      compliance_checklist: formattedCompliance,
      active_tenancy: tenancyData,
      maintenance_tickets: maintenanceTickets.map(t => ({
        ...t,
        created_at: t.created_at ? new Date(t.created_at).toISOString() : null,
        updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : null,
      })),
    }
  });
});


export const createProperty = catchAsync(async (req, res, next) => {
  const { landlord_id, address_line1, address_line2, city, postcode, property_type, bedrooms, rent_pcm, mgmt_fee_pct, key_ref, name } = req.body;

  const landlord = await db('users').where({ id: landlord_id, role: 'LANDLORD' }).first();
  if (!landlord) {
    throw new ApiError(404, 'Landlord not found');
  }

  const result = await db.transaction(async (trx) => {
    const tempRef = `TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [propertyId] = await trx('properties').insert({
      landlord_id,
      address_line1,
      address_line2: address_line2 || null,
      city,
      postcode,
      property_type: property_type || null,
      bedrooms: bedrooms !== undefined ? bedrooms : null,
      rent_pcm: rent_pcm !== undefined ? rent_pcm : null,
      mgmt_fee_pct: mgmt_fee_pct !== undefined ? mgmt_fee_pct : 12.00,
      key_ref: key_ref || null,
      name: name || address_line1,
      property_reference: tempRef,
      status: 'onboarding'
    });

    const property_reference = `REM-PRP-${String(propertyId).padStart(5, '0')}`;
    await trx('properties')
      .where({ id: propertyId })
      .update({ property_reference });

    const certTypes = ['EPC', 'EICR', 'GAS', 'SMOKE_CO', 'HMO', 'PAT'];
    const certRows = certTypes.map((type) => ({
      property_id: propertyId,
      cert_type: type,
      status: 'not_uploaded'
    }));

    await trx('property_certificates').insert(certRows);

    const checklistItems = [
      { item_code: 'GAS_CERT', item_label: 'Gas Safety Certificate' },
      { item_code: 'EICR_CERT', item_label: 'Electrical Installation Condition Report' },
      { item_code: 'EPC_CERT', item_label: 'Energy Performance Certificate' },
      { item_code: 'SMOKE_CO', item_label: 'Smoke & Carbon Monoxide Alarms' },
      { item_code: 'KEYS_RECEIVED', item_label: 'Physical Key References Received' }
    ];

    const checklistRows = checklistItems.map((item) => ({
      scope: 'property',
      entity_id: propertyId,
      item_code: item.item_code,
      item_label: item.item_label,
      applicable: 1,
      status: 'pending'
    }));

    await trx('compliance_checklist').insert(checklistRows);

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'PROPERTY_CREATED',
      entity_type: 'property',
      entity_id: propertyId,
      meta: JSON.stringify({ landlord_id, address_line1, city, postcode }),
      ip_address: req.ip || null
    });

    const newProperty = await trx('properties').where('id', propertyId).first();
    return formatProperty(newProperty);
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

export const updateProperty = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const propertyExists = await db('properties').where('id', id).first();
  if (!propertyExists) {
    throw new ApiError(404, 'Property not found');
  }

  // Column Whitelist
  const updateData = {};
  ALLOWED_PROPERTY_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  if (updateData.status === 'let') {
    const checklist = await db('compliance_checklist').where({ scope: 'property', entity_id: id });
    const incomplete = checklist.some((item) => item.status !== 'complete');
    if (incomplete || checklist.length === 0) {
      throw new ApiError(400, 'Cannot set status to let until all compliance checklist items are complete');
    }
  }

  await db.transaction(async (trx) => {
    if (Object.keys(updateData).length > 0) {
      await trx('properties').where('id', id).update({
        ...updateData,
        updated_at: trx.fn.now()
      });
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'PROPERTY_UPDATED',
      entity_type: 'property',
      entity_id: id,
      meta: JSON.stringify(updateData),
      ip_address: req.ip || null
    });
  });

  const updatedProperty = await db('properties').where('id', id).first();
  const formatted = formatProperty(updatedProperty);

  res.json({
    success: true,
    data: formatted
  });
});

export const updateCertificate = catchAsync(async (req, res, next) => {
  const { id, certType } = req.params;
  const { issued_at, expires_at, document_path, notes } = req.body;

  const allowedCerts = ['EPC', 'EICR', 'GAS', 'SMOKE_CO', 'HMO', 'PAT'];
  if (!allowedCerts.includes(certType)) {
    throw new ApiError(400, 'Invalid certificate type');
  }

  const propertyExists = await db('properties').where('id', id).first();
  if (!propertyExists) {
    throw new ApiError(404, 'Property not found');
  }

  // Calculate status
  const expiryDate = new Date(expires_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(today.getDate() + 90);
  ninetyDaysFromNow.setHours(0, 0, 0, 0);

  let certStatus = 'compliant';
  if (expiryDate < today) {
    certStatus = 'expired';
  } else if (expiryDate < ninetyDaysFromNow) {
    certStatus = 'expiring_soon';
  }

  // Map certType parameter to compliance checklist item code
  let itemCode = certType;
  if (certType === 'GAS') itemCode = 'GAS_CERT';
  else if (certType === 'EICR') itemCode = 'EICR_CERT';
  else if (certType === 'EPC') itemCode = 'EPC_CERT';

  await db.transaction(async (trx) => {
    await trx('property_certificates')
      .where({ property_id: id, cert_type: certType })
      .update({
        issued_at: issued_at ? new Date(issued_at) : null,
        expires_at: expires_at ? new Date(expires_at) : null,
        status: certStatus,
        document_path: document_path || null,
        notes: notes || null,
        updated_at: trx.fn.now()
      });

    // Mark corresponding compliance item complete if present in the checklist
    const checklistExists = await trx('compliance_checklist')
      .where({ scope: 'property', entity_id: id, item_code: itemCode })
      .first();

    if (checklistExists) {
      await trx('compliance_checklist')
        .where({ scope: 'property', entity_id: id, item_code: itemCode })
        .update({
          status: 'complete',
          verified_at: trx.fn.now(),
          verified_by: req.user.id
        });
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'PROPERTY_CERTIFICATE_UPLOADED',
      entity_type: 'property',
      entity_id: id,
      meta: JSON.stringify({ cert_type: certType, status: certStatus }),
      ip_address: req.ip || null
    });
  });

  const updatedCert = await db('property_certificates')
    .where({ property_id: id, cert_type: certType })
    .first();

  res.json({
    success: true,
    data: {
      ...updatedCert,
      issued_at: updatedCert.issued_at ? new Date(updatedCert.issued_at).toISOString().split('T')[0] : null,
      expires_at: updatedCert.expires_at ? new Date(updatedCert.expires_at).toISOString().split('T')[0] : null,
      created_at: updatedCert.created_at ? new Date(updatedCert.created_at).toISOString() : null,
      updated_at: updatedCert.updated_at ? new Date(updatedCert.updated_at).toISOString() : null
    }
  });
});

export const getMyProperties = catchAsync(async (req, res, next) => {
  const properties = await db('properties')
    .join('users', 'properties.landlord_id', 'users.id')
    .select(
      'properties.*',
      'users.name as landlord_name',
      db.raw(`(SELECT status FROM property_certificates WHERE property_id = properties.id AND cert_type = 'GAS' LIMIT 1) as gasCompliance`),
      db.raw(`(SELECT status FROM property_certificates WHERE property_id = properties.id AND cert_type = 'EPC' LIMIT 1) as epcCompliance`),
      db.raw(`(SELECT status FROM property_certificates WHERE property_id = properties.id AND cert_type = 'EICR' LIMIT 1) as eicrCompliance`)
    )
    .where('properties.landlord_id', req.user.id);

  const formatted = properties.map(formatProperty);

  res.json({
    success: true,
    data: formatted
  });
});

export const getMyPropertyById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const property = await db('properties')
    .join('users', 'properties.landlord_id', 'users.id')
    .select('properties.*', 'users.name as landlord_name', 'users.email as landlord_email')
    .where('properties.id', id)
    .first();

  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  if (property.landlord_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to perform this action');
  }

  const certificates = await db('property_certificates').where('property_id', id);
  const formattedCerts = certificates.map((c) => ({
    ...c,
    issued_at: c.issued_at ? new Date(c.issued_at).toISOString().split('T')[0] : null,
    expires_at: c.expires_at ? new Date(c.expires_at).toISOString().split('T')[0] : null,
    created_at: c.created_at ? new Date(c.created_at).toISOString() : null,
    updated_at: c.updated_at ? new Date(c.updated_at).toISOString() : null
  }));

  const compliance = await db('compliance_checklist').where({ scope: 'property', entity_id: id });
  const formattedCompliance = compliance.map((c) => ({
    ...c,
    verified_at: c.verified_at ? new Date(c.verified_at).toISOString() : null,
    created_at: c.created_at ? new Date(c.created_at).toISOString() : null,
    updated_at: c.updated_at ? new Date(c.updated_at).toISOString() : null
  }));

  const formattedProperty = formatProperty(property);

  res.json({
    success: true,
    data: {
      ...formattedProperty,
      property_certificates: formattedCerts,
      compliance_checklist: formattedCompliance
    }
  });
});

export const deletePropertyInternal = async (trx, propertyId) => {
  await trx('compliance_checklist').where({ scope: 'property', entity_id: propertyId }).delete();

  const docs = await trx('documents').where({ owner_type: 'property', owner_id: propertyId });
  for (const doc of docs) {
    const absPath = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
      } catch (err) {
        logger.error(`Failed to delete file on disk at ${absPath}: ${err.message}`);
      }
    }
  }
  await trx('documents').where({ owner_type: 'property', owner_id: propertyId }).delete();
  await trx('property_certificates').where('property_id', propertyId).delete();

  await trx('utilities').where('property_id', propertyId).delete();
  await trx('inspections').where('property_id', propertyId).delete();

  const ticketIds = await trx('maintenance_tickets').where('property_id', propertyId).pluck('id');
  if (ticketIds.length > 0) {
    const images = await trx('maintenance_images').whereIn('ticket_id', ticketIds);
    for (const img of images) {
      const absPath = path.join(process.cwd(), img.document_path);
      if (fs.existsSync(absPath)) {
        try {
          fs.unlinkSync(absPath);
        } catch (err) {
          logger.error(`Failed to delete maintenance image file at ${absPath}: ${err.message}`);
        }
      }
    }
    await trx('maintenance_images').whereIn('ticket_id', ticketIds).delete();
    await trx('maintenance_tickets').where('property_id', propertyId).delete();
  }

  await trx('agent_instructions').where('property_id', propertyId).delete();

  const tenancyIds = await trx('tenancies').where('property_id', propertyId).pluck('id');
  if (tenancyIds.length > 0) {
    const tenancyDocs = await trx('documents').where({ owner_type: 'tenancy' }).whereIn('owner_id', tenancyIds);
    for (const doc of tenancyDocs) {
      const absPath = path.join(process.cwd(), doc.file_path);
      if (fs.existsSync(absPath)) {
        try {
          fs.unlinkSync(absPath);
        } catch (err) {
          logger.error(`Failed to delete tenancy file at ${absPath}: ${err.message}`);
        }
      }
    }
    await trx('documents').where({ owner_type: 'tenancy' }).whereIn('owner_id', tenancyIds).delete();

    await trx('tenants').whereIn('tenancy_id', tenancyIds).delete();
    await trx('deposits').whereIn('tenancy_id', tenancyIds).delete();
    await trx('rent_schedules').whereIn('tenancy_id', tenancyIds).delete();
    await trx('rent_payments').whereIn('tenancy_id', tenancyIds).delete();
    await trx('fire_safety_signoffs').whereIn('tenancy_id', tenancyIds).delete();
    await trx('transactions').whereIn('tenancy_id', tenancyIds).delete();
    await trx('folders').where({ owner_type: 'tenancy' }).whereIn('owner_id', tenancyIds).delete();
    await trx('tenancies').where('property_id', propertyId).delete();
  }

  await trx('transactions').where('property_id', propertyId).delete();
  await trx('folders').where({ owner_type: 'property', owner_id: propertyId }).delete();
  await trx('properties').where('id', propertyId).delete();
};

export const deleteProperty = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const property = await db('properties').where('id', id).first();
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  await db.transaction(async (trx) => {
    await deletePropertyInternal(trx, id);

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'PROPERTY_DELETED',
      entity_type: 'property',
      entity_id: id,
      meta: JSON.stringify({ address_line1: property.address_line1, city: property.city, postcode: property.postcode }),
      ip_address: req.ip || null
    });
  });

  res.json({
    success: true,
    message: 'Property deleted successfully'
  });
});
