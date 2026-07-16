import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

const ALLOWED_DEPOSIT_FIELDS = [
  'registered_at',
  'prescribed_info_served_at',
  'status',
  'notes'
];

const formatDeposit = (d) => {
  if (!d) return null;
  return {
    ...d,
    holding_deposit: d.holding_deposit !== null && d.holding_deposit !== undefined ? parseFloat(d.holding_deposit).toFixed(2) : null,
    tenancy_deposit: d.tenancy_deposit !== null && d.tenancy_deposit !== undefined ? parseFloat(d.tenancy_deposit).toFixed(2) : null,
    received_at: d.received_at ? new Date(d.received_at).toISOString().split('T')[0] : null,
    register_due: d.register_due ? new Date(d.register_due).toISOString().split('T')[0] : null,
    registered_at: d.registered_at ? new Date(d.registered_at).toISOString().split('T')[0] : null,
    prescribed_info_served_at: d.prescribed_info_served_at ? new Date(d.prescribed_info_served_at).toISOString().split('T')[0] : null,
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

  let warning = null;
  if (updateData.registered_at) {
    const regDate = new Date(updateData.registered_at);
    const dueDate = new Date(deposit.register_due);
    if (regDate > dueDate) {
      warning = `Deposit was registered late (due date was ${formatDeposit(deposit).register_due})`;
    }
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
      meta: JSON.stringify({ ...updateData, warning }),
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
