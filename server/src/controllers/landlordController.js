import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { deletePropertyInternal } from './propertyController.js';
import { ensureLandlordSetup } from '../utils/landlordSetup.js';
import fs from 'fs';

const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12', 10);
import path from 'path';

// Helper to format landlord profile decimals and dates
const formatLandlord = (landlord) => {
  if (!landlord) return null;
  return {
    ...landlord,
    nrl_withhold_pct: landlord.nrl_withhold_pct !== null && landlord.nrl_withhold_pct !== undefined 
      ? parseFloat(landlord.nrl_withhold_pct).toFixed(2) 
      : null,
    ownership_share: landlord.ownership_share !== null && landlord.ownership_share !== undefined 
      ? parseFloat(landlord.ownership_share).toFixed(2) 
      : null,
    created_at: landlord.created_at ? new Date(landlord.created_at).toISOString() : null,
    updated_at: landlord.updated_at ? new Date(landlord.updated_at).toISOString() : null,
    tob_signed_at: landlord.tob_signed_at ? new Date(landlord.tob_signed_at).toISOString() : null,
    verified_at: landlord.verified_at ? new Date(landlord.verified_at).toISOString() : null,
    change_requested_at: landlord.change_requested_at ? new Date(landlord.change_requested_at).toISOString() : null
  };
};

export const getAllLandlords = catchAsync(async (req, res, next) => {
  const { status, search } = req.query;

  let query = db('users')
    .leftJoin('landlord_profiles', 'users.id', 'landlord_profiles.user_id')
    .leftJoin('landlord_payment_details', 'users.id', 'landlord_payment_details.user_id')
    .select(
      'users.id',
      'users.name',
      'users.email',
      'users.phone',
      'landlord_profiles.landlord_reference',
      'landlord_profiles.kyc_status',
      'landlord_profiles.tob_status',
      'landlord_profiles.ownership_confirmed',
      'landlord_profiles.is_overseas',
      'users.created_at',
      db.raw('(SELECT COUNT(*) FROM properties WHERE landlord_id = users.id) as propertiesCount'),
      db.raw("(SELECT COALESCE(SUM(net_paid), 0) FROM landlord_statements WHERE landlord_id = users.id AND status = 'paid') as payouts")
    )
    .where('users.role', 'LANDLORD');

  if (status) {
    query.where('landlord_profiles.kyc_status', status);
  }

  if (search) {
    const searchPattern = `%${search}%`;
    query.where((qb) => {
      qb.where('users.name', 'like', searchPattern)
        .orWhere('users.email', 'like', searchPattern);
    });
  }

  const landlords = await query;
  const formattedLandlords = landlords.map((l) => ({
    ...l,
    propertiesCount: parseInt(l.propertiesCount, 10) || 0,
    payouts: l.payouts !== null && l.payouts !== undefined ? parseFloat(l.payouts) : null,
    created_at: l.created_at ? new Date(l.created_at).toISOString() : null
  }));

  res.json({
    success: true,
    data: formattedLandlords
  });
});

export const getLandlordById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const landlord = await db('users')
    .leftJoin('landlord_profiles', 'users.id', 'landlord_profiles.user_id')
    .leftJoin('landlord_payment_details', 'users.id', 'landlord_payment_details.user_id')
    .select(
      'users.id',
      'users.name',
      'users.email',
      'users.phone',
      'users.address',
      'users.role',
      'landlord_profiles.company_name',
      'landlord_profiles.landlord_reference',
      'landlord_profiles.initials',
      'landlord_profiles.is_overseas',
      'landlord_profiles.nrl_hmrc_approved',
      'landlord_profiles.nrl_hmrc_ref',
      'landlord_profiles.nrl_withhold_pct',
      'landlord_profiles.kyc_status',
      'landlord_profiles.kyc_provider',
      'landlord_profiles.kyc_ref',
      'landlord_profiles.sanctions_checked',
      'landlord_profiles.tob_status',
      'landlord_profiles.tob_signed_at',
      'landlord_profiles.ownership_confirmed',
      'landlord_profiles.ownership_share',
      'landlord_payment_details.bank_name',
      'landlord_payment_details.account_name',
      'landlord_payment_details.account_number',
      'landlord_payment_details.sort_code',
      'landlord_payment_details.iban_bic',
      'landlord_payment_details.verified_at',
      'landlord_payment_details.change_pending',
      'landlord_payment_details.change_requested_at',
      'landlord_payment_details.change_verified_by',
      'users.created_at',
      'users.updated_at'
    )
    .where('users.id', id)
    .where('users.role', 'LANDLORD')
    .first();

  if (!landlord) {
    throw new ApiError(404, 'Landlord not found');
  }

  const properties = await db('properties').where('landlord_id', id);
  const formattedProperties = properties.map((p) => ({
    ...p,
    rent_pcm: p.rent_pcm !== null && p.rent_pcm !== undefined ? parseFloat(p.rent_pcm).toFixed(2) : null,
    mgmt_fee_pct: p.mgmt_fee_pct !== null && p.mgmt_fee_pct !== undefined ? parseFloat(p.mgmt_fee_pct).toFixed(2) : null,
    created_at: p.created_at ? new Date(p.created_at).toISOString() : null,
    updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : null
  }));

  const compliance = await db('compliance_checklist').where({ scope: 'landlord', entity_id: id });
  const formattedCompliance = compliance.map((c) => ({
    ...c,
    verified_at: c.verified_at ? new Date(c.verified_at).toISOString() : null,
    created_at: c.created_at ? new Date(c.created_at).toISOString() : null,
    updated_at: c.updated_at ? new Date(c.updated_at).toISOString() : null
  }));

  const formattedLandlord = formatLandlord(landlord);

  res.json({
    success: true,
    data: {
      ...formattedLandlord,
      properties: formattedProperties,
      compliance_checklist: formattedCompliance
    }
  });
});

// Landlord-portal view of the caller's own compliance checklist: their
// landlord-scope items plus the property-scope items of every property they own.
export const getMyChecklist = catchAsync(async (req, res, next) => {
  const formatItem = (c) => ({
    id: c.id,
    scope: c.scope,
    item_code: c.item_code,
    item_label: c.item_label,
    applicable: c.applicable,
    status: c.status,
    verified_at: c.verified_at ? new Date(c.verified_at).toISOString() : null
  });

  const landlordItems = await db('compliance_checklist')
    .where({ scope: 'landlord', entity_id: req.user.id })
    .orderBy('id', 'asc');

  const propertyItems = await db('compliance_checklist')
    .join('properties', 'compliance_checklist.entity_id', 'properties.id')
    .select(
      'compliance_checklist.*',
      'properties.id as property_id',
      'properties.property_reference',
      'properties.address_line1',
      'properties.city'
    )
    .where('compliance_checklist.scope', 'property')
    .where('properties.landlord_id', req.user.id)
    .orderBy(['properties.id', 'compliance_checklist.id']);

  res.json({
    success: true,
    data: {
      landlord: landlordItems.map(formatItem),
      property: propertyItems.map((c) => ({
        ...formatItem(c),
        property_id: c.property_id,
        property_reference: c.property_reference,
        property_address: `${c.address_line1}, ${c.city}`
      }))
    }
  });
});

export const createLandlord = catchAsync(async (req, res, next) => {
  const {
    name, email, phone, address, company_name, is_overseas, ownership_share, tob_status,
    nrl_hmrc_approved, nrl_hmrc_ref, nrl_withhold_pct, initials
  } = req.body;

  const existingUser = await db('users').where({ email: email.toLowerCase() }).first();
  if (existingUser) {
    throw new ApiError(409, 'Email already registered');
  }

  const tempPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await bcrypt.hash(tempPassword, BCRYPT_COST);

  const result = await db.transaction(async (trx) => {
    const [userId] = await trx('users').insert({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      address,
      role: 'LANDLORD'
    });

    await ensureLandlordSetup(trx, userId, {
      company_name: company_name || null,
      is_overseas: is_overseas ? 1 : 0,
      ownership_share: ownership_share !== undefined ? ownership_share : null,
      tob_status: tob_status || 'not_sent',
      ...(nrl_hmrc_approved !== undefined ? { nrl_hmrc_approved: nrl_hmrc_approved ? 1 : 0 } : {}),
      ...(nrl_hmrc_ref ? { nrl_hmrc_ref } : {}),
      ...(nrl_withhold_pct !== undefined ? { nrl_withhold_pct } : {}),
      ...(initials ? { initials } : {})
    });

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'LANDLORD_CREATED',
      entity_type: 'landlord',
      entity_id: userId,
      meta: JSON.stringify({ email, name }),
      ip_address: req.ip || null
    });

    return { id: userId, name, email };
  });

  logger.info(`Landlord created: ${result.id} (${result.name})`);

  res.status(201).json({
    success: true,
    data: result
  });
});

export const updateLandlordKyc = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { kyc_status, kyc_ref, kyc_provider } = req.body;

  const landlordExists = await db('users').where({ id, role: 'LANDLORD' }).first();
  if (!landlordExists) {
    throw new ApiError(404, 'Landlord not found');
  }

  const updateData = {};
  if (kyc_status !== undefined) updateData.kyc_status = kyc_status;
  if (kyc_ref !== undefined) updateData.kyc_ref = kyc_ref;
  if (kyc_provider !== undefined) updateData.kyc_provider = kyc_provider;

  await db.transaction(async (trx) => {
    await trx('landlord_profiles').where({ user_id: id }).update(updateData);

    if (kyc_status === 'passed') {
      await trx('compliance_checklist')
        .where({ scope: 'landlord', entity_id: id, item_code: 'KYC_PENDING' })
        .update({
          status: 'complete',
          verified_at: trx.fn.now(),
          verified_by: req.user.id
        });
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'LANDLORD_KYC_UPDATED',
      entity_type: 'landlord',
      entity_id: id,
      meta: JSON.stringify(updateData),
      ip_address: req.ip || null
    });
  });

  const profile = await db('landlord_profiles').where({ user_id: id }).first();
  const formattedProfile = formatLandlord(profile);

  res.json({
    success: true,
    data: formattedProfile
  });
});

export const updatePaymentDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { bank_name, account_name, account_number, sort_code, iban_bic } = req.body;

  const landlordExists = await db('users').where({ id, role: 'LANDLORD' }).first();
  if (!landlordExists) {
    throw new ApiError(404, 'Landlord not found');
  }

  const payDetails = {
    bank_name,
    account_name,
    account_number,
    sort_code,
    iban_bic: iban_bic || null,
    change_pending: 1,
    change_requested_at: db.fn.now()
  };

  await db.transaction(async (trx) => {
    const existing = await trx('landlord_payment_details').where({ user_id: id }).first();

    if (existing) {
      await trx('landlord_payment_details').where({ user_id: id }).update(payDetails);
    } else {
      await trx('landlord_payment_details').insert({
        user_id: id,
        ...payDetails
      });
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'PAYMENT_DETAILS_CHANGE_REQUESTED',
      entity_type: 'landlord',
      entity_id: id,
      meta: JSON.stringify({ bank_name, account_name }),
      ip_address: req.ip || null
    });
  });

  res.json({
    success: true,
    message: 'Payment details update submitted for verification'
  });
});

export const verifyPaymentDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const landlordExists = await db('users').where({ id, role: 'LANDLORD' }).first();
  if (!landlordExists) {
    throw new ApiError(404, 'Landlord not found');
  }

  await db.transaction(async (trx) => {
    await trx('landlord_payment_details')
      .where({ user_id: id })
      .update({
        verified_at: trx.fn.now(),
        change_pending: 0,
        change_verified_by: req.user.id
      });

    await trx('compliance_checklist')
      .where({ scope: 'landlord', entity_id: id, item_code: 'BANK_DETAILS_ADDED' })
      .update({
        status: 'complete',
        verified_at: trx.fn.now(),
        verified_by: req.user.id
      });

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'PAYMENT_DETAILS_VERIFIED',
      entity_type: 'landlord',
      entity_id: id,
      meta: JSON.stringify({ verified_by: req.user.id }),
      ip_address: req.ip || null
    });
  });

  res.json({
    success: true,
    message: 'Payment details verified successfully'
  });
});

export const updateLandlord = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    name, email, phone, address,
    company_name, is_overseas, nrl_hmrc_approved, nrl_hmrc_ref, nrl_withhold_pct, kyc_status, tob_status, ownership_share,
    ownership_confirmed, initials
  } = req.body;

  const landlord = await db('users').where({ id, role: 'LANDLORD' }).first();
  if (!landlord) {
    throw new ApiError(404, 'Landlord not found');
  }

  const userUpdates = {};
  if (name !== undefined) userUpdates.name = name;
  if (email !== undefined) userUpdates.email = email.toLowerCase().trim();
  if (phone !== undefined) userUpdates.phone = phone;
  if (address !== undefined) userUpdates.address = address;

  const profileUpdates = {};
  if (company_name !== undefined) profileUpdates.company_name = company_name;
  if (is_overseas !== undefined) profileUpdates.is_overseas = is_overseas ? 1 : 0;
  if (nrl_hmrc_approved !== undefined) profileUpdates.nrl_hmrc_approved = nrl_hmrc_approved ? 1 : 0;
  if (nrl_hmrc_ref !== undefined) profileUpdates.nrl_hmrc_ref = nrl_hmrc_ref;
  if (nrl_withhold_pct !== undefined) profileUpdates.nrl_withhold_pct = nrl_withhold_pct !== '' ? parseFloat(nrl_withhold_pct).toFixed(2) : null;
  if (kyc_status !== undefined) profileUpdates.kyc_status = kyc_status;
  if (tob_status !== undefined) profileUpdates.tob_status = tob_status;
  if (ownership_share !== undefined) profileUpdates.ownership_share = ownership_share !== '' ? parseFloat(ownership_share).toFixed(2) : null;
  if (initials !== undefined) profileUpdates.initials = initials || null;
  // Ownership confirmation is an explicit admin decision — never inferred from
  // KYC passing (they verify different things).
  if (ownership_confirmed !== undefined) profileUpdates.ownership_confirmed = ownership_confirmed ? 1 : 0;

  await db.transaction(async (trx) => {
    if (Object.keys(userUpdates).length > 0) {
      await trx('users').where({ id }).update(userUpdates);
    }

    if (Object.keys(profileUpdates).length > 0) {
      const profile = await trx('landlord_profiles').where({ user_id: id }).first();
      if (profile) {
        await trx('landlord_profiles').where({ user_id: id }).update(profileUpdates);
      } else {
        await trx('landlord_profiles').insert({
          user_id: id,
          ...profileUpdates
        });
      }
    }

    // Keep the checklist item in step with an explicit ownership confirmation.
    if (ownership_confirmed !== undefined) {
      await trx('compliance_checklist')
        .where({ scope: 'landlord', entity_id: id, item_code: 'OWNERSHIP_CONFIRMED' })
        .update(ownership_confirmed
          ? { status: 'complete', verified_at: trx.fn.now(), verified_by: req.user.id }
          : { status: 'pending', verified_at: null, verified_by: null });
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'LANDLORD_UPDATED',
      entity_type: 'landlord',
      entity_id: id,
      meta: JSON.stringify({ ...userUpdates, ...profileUpdates }),
      ip_address: req.ip || null
    });
  });

  const updatedLandlord = await db('users')
    .leftJoin('landlord_profiles', 'users.id', 'landlord_profiles.user_id')
    .select('users.*', 'landlord_profiles.company_name', 'landlord_profiles.landlord_reference', 'landlord_profiles.is_overseas', 'landlord_profiles.nrl_hmrc_approved', 'landlord_profiles.nrl_hmrc_ref', 'landlord_profiles.nrl_withhold_pct', 'landlord_profiles.kyc_status', 'landlord_profiles.tob_status', 'landlord_profiles.ownership_share', 'landlord_profiles.ownership_confirmed', 'landlord_profiles.initials')
    .where('users.id', id)
    .first();

  if (updatedLandlord) {
    delete updatedLandlord.password;
  }

  res.json({
    success: true,
    data: formatLandlord(updatedLandlord)
  });
});

// Shared erasure cascade — used by admin deletion and landlord self-erasure (GDPR Art. 17).
// `actor` = { id, role, ip }. Deliberately stores NO name/email in the audit trail.
export const eraseLandlordData = async (trx, id, actor) => {
  const properties = await trx('properties').where('landlord_id', id);
  for (const prop of properties) {
    await deletePropertyInternal(trx, prop.id);
  }

  await trx('compliance_checklist').where({ scope: 'landlord', entity_id: id }).delete();

  const docs = await trx('documents').where({ owner_type: 'landlord', owner_id: id });
  for (const doc of docs) {
    const absPath = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
      } catch (err) {
        logger.error(`Failed to delete landlord file at ${absPath}: ${err.message}`);
      }
    }
  }
  await trx('documents').where({ owner_type: 'landlord', owner_id: id }).delete();

  const statements = await trx('landlord_statements').where('landlord_id', id);
  const docIds = statements.map(s => s.document_id).filter(Boolean);
  if (docIds.length > 0) {
    const statementDocs = await trx('documents').whereIn('id', docIds);
    for (const doc of statementDocs) {
      const absPath = path.join(process.cwd(), doc.file_path);
      if (fs.existsSync(absPath)) {
        try { fs.unlinkSync(absPath); } catch (err) { logger.error(err); }
      }
    }
    await trx('documents').whereIn('id', docIds).delete();
  }
  await trx('landlord_statements').where('landlord_id', id).delete();

  await trx('transactions').where('landlord_id', id).delete();
  await trx('folders').where({ owner_type: 'landlord', owner_id: id }).delete();

  // Delete agent_instructions for this landlord (viewings cascade automatically via FK)
  await trx('agent_instructions').where('landlord_id', id).delete();

  await trx('users').where({ id, role: 'LANDLORD' }).delete();

  await trx('audit_log').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'LANDLORD_DELETED',
    entity_type: 'landlord',
    entity_id: id,
    meta: JSON.stringify({ erased: true }), // name/email intentionally NOT retained
    ip_address: actor.ip || null
  });
};

export const deleteLandlord = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const landlord = await db('users').where({ id, role: 'LANDLORD' }).first();
  if (!landlord) {
    throw new ApiError(404, 'Landlord not found');
  }

  await db.transaction((trx) => eraseLandlordData(trx, id, { id: req.user.id, role: req.user.role, ip: req.ip }));

  res.json({
    success: true,
    message: 'Landlord deleted successfully'
  });
});

