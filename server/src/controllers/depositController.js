import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { toYmd, todayYmd, addDays } from '../utils/dateHelpers.js';

const ALLOWED_DEPOSIT_FIELDS = [
  'registered_at',
  'prescribed_info_served_at',
  'status',
  'notes',
  // Corrections from Edit Tenant (a wrong amount, scheme or date received).
  'tenancy_deposit',
  'scheme',
  'received_at'
];
const DEPOSIT_SCHEMES = ['TDS', 'DPS', 'mydeposits'];
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(new Date(v).getTime());

const formatDeposit = (d) => {
  if (!d) return null;
  return {
    ...d,
    holding_deposit: d.holding_deposit !== null && d.holding_deposit !== undefined ? parseFloat(d.holding_deposit).toFixed(2) : null,
    tenancy_deposit: d.tenancy_deposit !== null && d.tenancy_deposit !== undefined ? parseFloat(d.tenancy_deposit).toFixed(2) : null,
    received_at: toYmd(d.received_at),
    register_due: toYmd(d.register_due),
    registered_at: toYmd(d.registered_at),
    prescribed_info_served_at: toYmd(d.prescribed_info_served_at),
    created_at: d.created_at ? new Date(d.created_at).toISOString() : null,
    updated_at: d.updated_at ? new Date(d.updated_at).toISOString() : null
  };
};

export const updateDeposit = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const deposit = await db('deposits').where('id', id).first();
  if (!deposit) {
    throw new ApiError(404, 'Deposit record not found');
  }

  // Column Whitelist
  const updateData = {};
  ALLOWED_DEPOSIT_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  if ('tenancy_deposit' in updateData) {
    const value = parseFloat(updateData.tenancy_deposit);
    if (Number.isNaN(value) || value <= 0) throw new ApiError(400, 'Enter the deposit amount');
    updateData.tenancy_deposit = value.toFixed(2);
  }
  if ('scheme' in updateData && !DEPOSIT_SCHEMES.includes(updateData.scheme)) {
    throw new ApiError(400, `Deposit scheme must be one of ${DEPOSIT_SCHEMES.join(', ')}`);
  }
  if ('received_at' in updateData) {
    if (!isYmd(updateData.received_at)) throw new ApiError(400, 'Enter the date the deposit was received');
    if (updateData.received_at > todayYmd()) throw new ApiError(400, 'The date received cannot be in the future');
    // It must be registered within 30 days of being received.
    updateData.register_due = addDays(updateData.received_at, 30);
  }
  if ('registered_at' in updateData) {
    if (updateData.registered_at === '' || updateData.registered_at === null) {
      updateData.registered_at = null;
      if (!('status' in updateData) && deposit.status === 'registered') updateData.status = 'pending_registration';
    } else {
      if (!isYmd(updateData.registered_at)) throw new ApiError(400, 'Enter the date it was registered with the scheme');
      if (updateData.registered_at > todayYmd()) throw new ApiError(400, 'The registered date cannot be in the future');
      if (!('status' in updateData) && deposit.status === 'pending_registration') updateData.status = 'registered';
    }
  }

  let warning = null;
  const dueYmd = updateData.register_due || toYmd(deposit.register_due);
  if (updateData.registered_at && updateData.registered_at > dueYmd) {
    warning = `Deposit was registered late (due date was ${dueYmd})`;
  }

  await db.transaction(async (trx) => {
    if (Object.keys(updateData).length > 0) {
      await trx('deposits')
        .where('id', id)
        .update({
          ...updateData,
          updated_at: trx.fn.now()
        });
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'DEPOSIT_UPDATED',
      entity_type: 'deposit',
      entity_id: id,
      meta: JSON.stringify({ ...updateData, warning, before: {
        tenancy_deposit: deposit.tenancy_deposit, scheme: deposit.scheme, received_at: toYmd(deposit.received_at),
        registered_at: toYmd(deposit.registered_at), status: deposit.status
      } }),
      ip_address: req.ip || null
    });
  });

  const updatedDeposit = await db('deposits').where('id', id).first();

  res.json({
    success: true,
    warning,
    data: formatDeposit(updatedDeposit)
  });
});

export const getAllDeposits = catchAsync(async (req, res, next) => {
  const deposits = await db('deposits')
    .join('tenancies', 'deposits.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .join('users', 'properties.landlord_id', 'users.id')
    .leftJoin('tenants', function() {
      this.on('tenants.tenancy_id', '=', 'tenancies.id').andOn('tenants.is_lead_tenant', '=', db.raw('1'));
    })
    .select(
      'deposits.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'users.name as landlord_name',
      'tenants.name as lead_tenant_name'
    )
    .orderBy('deposits.created_at', 'desc');

  res.json({
    success: true,
    data: deposits.map(d => ({
      ...formatDeposit(d),
      address_line1: d.address_line1,
      city: d.city,
      postcode: d.postcode,
      landlord_name: d.landlord_name,
      lead_tenant_name: d.lead_tenant_name || '-'
    }))
  });
});

export const getDepositsNeedingRegistration = catchAsync(async (req, res, next) => {
  // Query deposits needing registration (registered_at is NULL and register_due is within next 7 days)
  const deposits = await db('deposits')
    .join('tenancies', 'deposits.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .join('users', 'properties.landlord_id', 'users.id')
    .select(
      'deposits.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'users.name as landlord_name'
    )
    .whereNull('deposits.registered_at')
    .where('deposits.register_due', '<=', db.raw('DATE_ADD(NOW(), INTERVAL 7 DAY)'))
    .orderBy('deposits.register_due', 'asc');

  res.json({
    success: true,
    data: deposits.map(d => ({
      ...formatDeposit(d),
      address_line1: d.address_line1,
      city: d.city,
      postcode: d.postcode,
      landlord_name: d.landlord_name
    }))
  });
});
