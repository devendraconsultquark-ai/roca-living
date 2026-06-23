import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

// Date utility functions immune to timezone shifts
const addDays = (dateStr, days) => {
  const parts = dateStr.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addMonths = (dateStr, months) => {
  const parts = dateStr.split('-');
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setMonth(d.getMonth() + months);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const generateSchedules = (startDateStr, endDateStr, rentPcm) => {
  const schedules = [];
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : null;
  
  let i = 0;
  while (true) {
    const nextDateStr = addMonths(startDateStr, i);
    const nextDate = new Date(nextDateStr);
    
    if (end && nextDate > end) {
      break;
    }
    if (!end && i >= 12) {
      break;
    }
    
    schedules.push({
      due_date: nextDateStr,
      amount: parseFloat(rentPcm).toFixed(2),
      status: 'due'
    });
    i++;
  }
  return schedules;
};

// Formatting helpers
const formatTenancy = (t) => {
  if (!t) return null;
  return {
    ...t,
    rent_pcm: t.rent_pcm !== null && t.rent_pcm !== undefined ? parseFloat(t.rent_pcm).toFixed(2) : null,
    agent_letting_fee: t.agent_letting_fee !== null && t.agent_letting_fee !== undefined ? parseFloat(t.agent_letting_fee).toFixed(2) : null,
    roca_letting_fee: t.roca_letting_fee !== null && t.roca_letting_fee !== undefined ? parseFloat(t.roca_letting_fee).toFixed(2) : null,
    start_date: t.start_date ? new Date(t.start_date).toISOString().split('T')[0] : null,
    end_date: t.end_date ? new Date(t.end_date).toISOString().split('T')[0] : null,
    created_at: t.created_at ? new Date(t.created_at).toISOString() : null,
    updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : null
  };
};

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

const formatRentSchedule = (s) => {
  if (!s) return null;
  return {
    ...s,
    amount: s.amount !== null && s.amount !== undefined ? parseFloat(s.amount).toFixed(2) : null,
    due_date: s.due_date ? new Date(s.due_date).toISOString().split('T')[0] : null,
    created_at: s.created_at ? new Date(s.created_at).toISOString() : null
  };
};

const formatRentPayment = (p) => {
  if (!p) return null;
  return {
    ...p,
    amount: p.amount !== null && p.amount !== undefined ? parseFloat(p.amount).toFixed(2) : null,
    received_at: p.received_at ? new Date(p.received_at).toISOString().split('T')[0] : null,
    reconciled_at: p.reconciled_at ? new Date(p.reconciled_at).toISOString() : null,
    created_at: p.created_at ? new Date(p.created_at).toISOString() : null
  };
};

export const createTenancy = catchAsync(async (req, res, next) => {
  const {
    property_id,
    start_date,
    end_date,
    rent_pcm,
    frequency,
    agent_letting_fee,
    roca_letting_fee,
    tenants,
    deposit
  } = req.body;

  const property = await db('properties').where('id', property_id).first();
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  if (!tenants || !Array.isArray(tenants) || tenants.length === 0) {
    throw new ApiError(400, 'At least one tenant is required');
  }

  if (!deposit || !deposit.amount || !deposit.received_at) {
    throw new ApiError(400, 'Deposit amount and received date are required');
  }

  const result = await db.transaction(async (trx) => {
    // 1. Insert Tenancy
    const [tenancyId] = await trx('tenancies').insert({
      property_id,
      status: 'active',
      start_date,
      end_date: end_date || null,
      rent_pcm: parseFloat(rent_pcm).toFixed(2),
      rent_frequency: frequency || 'monthly',
      agent_letting_fee: agent_letting_fee !== undefined ? parseFloat(agent_letting_fee).toFixed(2) : null,
      roca_letting_fee: roca_letting_fee !== undefined ? parseFloat(roca_letting_fee).toFixed(2) : null,
      created_by: req.user.id
    });

    // 2. Insert Tenants
    const tenantRows = tenants.map(t => ({
      tenancy_id: tenancyId,
      name: t.name,
      email: t.email || null,
      phone: t.phone || null,
      is_lead_tenant: t.is_lead_tenant ? 1 : 0,
      right_to_rent_status: 'pending'
    }));
    await trx('tenants').insert(tenantRows);

    // 3. Insert Deposit
    const registerDue = addDays(deposit.received_at, 30);
    const [depositId] = await trx('deposits').insert({
      tenancy_id: tenancyId,
      holding_deposit: deposit.holding_deposit !== undefined ? parseFloat(deposit.holding_deposit).toFixed(2) : null,
      tenancy_deposit: parseFloat(deposit.amount).toFixed(2),
      scheme: deposit.scheme || 'TDS',
      received_at: deposit.received_at,
      register_due: registerDue,
      status: 'pending_registration'
    });

    // 4. Generate rent schedules
    const schedules = generateSchedules(start_date, end_date, rent_pcm);
    const scheduleRows = schedules.map(s => ({
      tenancy_id: tenancyId,
      due_date: s.due_date,
      amount: s.amount,
      status: 'due'
    }));
    await trx('rent_schedules').insert(scheduleRows);

    // 5. Update property status to 'let'
    await trx('properties').where('id', property_id).update({ status: 'let' });

    // 6. Audit Log
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'TENANCY_CREATED',
      entity_type: 'tenancy',
      entity_id: tenancyId,
      meta: JSON.stringify({ property_id, rent_pcm, deposit_amount: deposit.amount }),
      ip_address: req.ip || null
    });

    // Fetch full response payload
    const tenancyObj = await trx('tenancies').where('id', tenancyId).first();
    const tenantsList = await trx('tenants').where('tenancy_id', tenancyId);
    const depositObj = await trx('deposits').where('id', depositId).first();

    return {
      tenancy: formatTenancy(tenancyObj),
      tenants: tenantsList,
      deposit: formatDeposit(depositObj)
    };
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

export const getAllTenancies = catchAsync(async (req, res, next) => {
  const { status, property_id, landlord_id } = req.query;

  let query = db('tenancies')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .join('users', 'properties.landlord_id', 'users.id')
    .select(
      'tenancies.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'users.name as landlord_name',
      'users.email as landlord_email'
    );

  if (status) {
    query.where('tenancies.status', status);
  }
  if (property_id) {
    query.where('tenancies.property_id', property_id);
  }
  if (landlord_id) {
    query.where('properties.landlord_id', landlord_id);
  }

  const list = await query.orderBy('tenancies.created_at', 'desc');
  const formatted = list.map(formatTenancy);

  res.json({
    success: true,
    data: formatted
  });
});

export const getTenancyById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const tenancy = await db('tenancies').where('id', id).first();
  if (!tenancy) {
    throw new ApiError(404, 'Tenancy not found');
  }

  const property = await db('properties').where('id', tenancy.property_id).first();
  const landlord = await db('users').where('id', property.landlord_id).first();
  const tenants = await db('tenants').where('tenancy_id', id);
  const deposit = await db('deposits').where('tenancy_id', id).first();
  
  // Next 3 upcoming due/overdue rent schedules
  const rentSchedules = await db('rent_schedules')
    .where('tenancy_id', id)
    .whereIn('status', ['due', 'overdue'])
    .orderBy('due_date', 'asc')
    .limit(3);

  // Recent 5 rent payments
  const rentPayments = await db('rent_payments')
    .where('tenancy_id', id)
    .orderBy('received_at', 'desc')
    .limit(5);

  res.json({
    success: true,
    data: {
      ...formatTenancy(tenancy),
      property,
      landlord: landlord ? { id: landlord.id, name: landlord.name, email: landlord.email, phone: landlord.phone } : null,
      tenants,
      deposit: formatDeposit(deposit),
      rent_schedules: rentSchedules.map(formatRentSchedule),
      rent_payments: rentPayments.map(formatRentPayment)
    }
  });
});

export const recordRentPayment = catchAsync(async (req, res, next) => {
  const { id } = req.params; // tenancyId
  const { received_at, amount, method, reference, notes } = req.body;

  if (!received_at || !amount || !method) {
    throw new ApiError(400, 'Received date, amount, and method are required');
  }

  const tenancy = await db('tenancies').where('id', id).first();
  if (!tenancy) {
    throw new ApiError(404, 'Tenancy not found');
  }

  const property = await db('properties').where('id', tenancy.property_id).first();

  const result = await db.transaction(async (trx) => {
    const formattedAmount = parseFloat(amount).toFixed(2);

    // Auto-reconcile logic: oldest matching due/overdue schedule
    const matchedSchedule = await trx('rent_schedules')
      .where({
        tenancy_id: id,
        amount: formattedAmount
      })
      .whereIn('status', ['due', 'overdue'])
      .orderBy('due_date', 'asc')
      .first();

    const isReconciled = !!matchedSchedule;

    // 1. Insert rent payment
    const [paymentId] = await trx('rent_payments').insert({
      tenancy_id: id,
      schedule_id: isReconciled ? matchedSchedule.id : null,
      received_at,
      amount: formattedAmount,
      method,
      reference: reference || null,
      reconciled: isReconciled ? 1 : 0,
      reconciled_at: isReconciled ? trx.fn.now() : null,
      reconciled_by: isReconciled ? req.user.id : null,
      notes: notes || null
    });

    // 2. Update schedule if reconciled
    if (isReconciled) {
      await trx('rent_schedules')
        .where('id', matchedSchedule.id)
        .update({ status: 'paid' });
    }

    // 3. Write transaction row
    await trx('transactions').insert({
      type: 'rent_in',
      property_id: tenancy.property_id,
      landlord_id: property.landlord_id,
      tenancy_id: id,
      amount: formattedAmount,
      transaction_date: received_at,
      reconciled: isReconciled ? 1 : 0,
      created_by: req.user.id,
      description: `Rent payment received for tenancy ID ${id}${reference ? ' (Ref: ' + reference + ')' : ''}`
    });

    // 4. Audit Log
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'RENT_PAYMENT_RECORDED',
      entity_type: 'rent_payment',
      entity_id: paymentId,
      meta: JSON.stringify({ tenancy_id: id, amount: formattedAmount, reconciled: isReconciled }),
      ip_address: req.ip || null
    });

    const paymentObj = await trx('rent_payments').where('id', paymentId).first();

    return {
      payment: formatRentPayment(paymentObj),
      reconciled: isReconciled,
      matched_schedule_id: isReconciled ? matchedSchedule.id : null
    };
  });

  res.status(201).json({
    success: true,
    data: result
  });
});

export const getRentPayments = catchAsync(async (req, res, next) => {
  const { id } = req.params; // tenancyId

  const list = await db('rent_payments')
    .where('tenancy_id', id)
    .orderBy('received_at', 'desc');

  res.json({
    success: true,
    data: list.map(formatRentPayment)
  });
});

export const getUnreconciledPayments = catchAsync(async (req, res, next) => {
  const list = await db('rent_payments')
    .join('tenancies', 'rent_payments.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .leftJoin('tenants', function() {
      this.on('tenants.tenancy_id', '=', 'tenancies.id').andOn('tenants.is_lead_tenant', '=', db.raw('1'));
    })
    .select(
      'rent_payments.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'tenancies.rent_pcm',
      'tenants.name as lead_tenant_name'
    )
    .where('rent_payments.reconciled', 0)
    .orWhereNull('rent_payments.schedule_id')
    .orderBy('rent_payments.received_at', 'asc');

  res.json({
    success: true,
    data: list.map(p => ({
      ...formatRentPayment(p),
      address_line1: p.address_line1,
      city: p.city,
      postcode: p.postcode,
      rent_pcm: p.rent_pcm !== null && p.rent_pcm !== undefined ? parseFloat(p.rent_pcm).toFixed(2) : null,
      lead_tenant_name: p.lead_tenant_name || '-'
    }))
  });
});

export const manualReconcile = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;
  const { schedule_id } = req.body;

  if (!schedule_id) {
    throw new ApiError(400, 'schedule_id is required');
  }

  const payment = await db('rent_payments').where('id', paymentId).first();
  if (!payment) {
    throw new ApiError(404, 'Rent payment not found');
  }

  const schedule = await db('rent_schedules').where('id', schedule_id).first();
  if (!schedule) {
    throw new ApiError(404, 'Rent schedule not found');
  }

  await db.transaction(async (trx) => {
    // 1. Link payment to schedule and set reconciled=1
    await trx('rent_payments')
      .where('id', paymentId)
      .update({
        schedule_id,
        reconciled: 1,
        reconciled_at: trx.fn.now(),
        reconciled_by: req.user.id
      });

    // 2. Update schedule status to 'paid'
    await trx('rent_schedules')
      .where('id', schedule_id)
      .update({ status: 'paid' });

    // 3. Update associated transactions reconciled=1
    await trx('transactions')
      .where({
        tenancy_id: payment.tenancy_id,
        amount: payment.amount,
        type: 'rent_in'
      })
      .update({ reconciled: 1 });

    // 4. Audit Log
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'RENT_PAYMENT_MANUAL_RECONCILED',
      entity_type: 'rent_payment',
      entity_id: paymentId,
      meta: JSON.stringify({ schedule_id }),
      ip_address: req.ip || null
    });
  });

  res.json({
    success: true,
    message: 'Payment reconciled successfully'
  });
});

export const getMyTenancies = catchAsync(async (req, res, next) => {
  const list = await db('tenancies')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .leftJoin('tenants', function() {
      this.on('tenants.tenancy_id', '=', 'tenancies.id').andOn('tenants.is_lead_tenant', '=', db.raw('1'));
    })
    .leftJoin('deposits', 'deposits.tenancy_id', 'tenancies.id')
    .select(
      'tenancies.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'tenants.name as lead_tenant_name',
      'deposits.tenancy_deposit as deposit_amount',
      'deposits.scheme as deposit_scheme'
    )
    .where('properties.landlord_id', req.user.id)
    .orderBy('tenancies.created_at', 'desc');

  res.json({
    success: true,
    data: list.map(t => ({
      ...formatTenancy(t),
      lead_tenant_name: t.lead_tenant_name || '-',
      deposit_amount: t.deposit_amount !== null && t.deposit_amount !== undefined ? parseFloat(t.deposit_amount).toFixed(2) : null,
      deposit_scheme: t.deposit_scheme || '-'
    }))
  });
});

export const getPayments = catchAsync(async (req, res, next) => {
  const { reconciled } = req.query;

  let query = db('rent_payments')
    .join('tenancies', 'rent_payments.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .leftJoin('tenants', function() {
      this.on('tenants.tenancy_id', '=', 'tenancies.id').andOn('tenants.is_lead_tenant', '=', db.raw('1'));
    })
    .select(
      'rent_payments.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'tenants.name as tenant_name'
    );

  if (reconciled !== undefined) {
    query.where('rent_payments.reconciled', reconciled === '1' || reconciled === 'true' ? 1 : 0);
  }

  const payments = await query.orderBy('rent_payments.received_at', 'desc');
  
  res.json({
    success: true,
    data: payments.map(p => ({
      ...formatRentPayment(p),
      address_line1: p.address_line1,
      city: p.city,
      postcode: p.postcode,
      tenant_name: p.tenant_name || '-'
    }))
  });
});

export const getArrears = catchAsync(async (req, res, next) => {
  const arrears = await db('rent_schedules')
    .join('tenancies', 'rent_schedules.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .leftJoin('tenants', function() {
      this.on('tenants.tenancy_id', '=', 'tenancies.id').andOn('tenants.is_lead_tenant', '=', db.raw('1'));
    })
    .select(
      'rent_schedules.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'tenancies.rent_pcm',
      'tenants.name as tenant_name'
    )
    .where('rent_schedules.status', 'overdue')
    .orderBy('rent_schedules.due_date', 'asc');

  const tenanciesWithArrears = {};
  for (const row of arrears) {
    const tenancyId = row.tenancy_id;
    if (!tenanciesWithArrears[tenancyId]) {
      const lastPayment = await db('rent_payments')
        .where({ tenancy_id: tenancyId, reconciled: 1 })
        .orderBy('received_at', 'desc')
        .first();

      const oldestDueDate = new Date(row.due_date);
      const today = new Date();
      const diffTime = Math.abs(today - oldestDueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      tenanciesWithArrears[tenancyId] = {
        id: `arr-${tenancyId}`,
        name: row.tenant_name || '-',
        property: `${row.address_line1}, ${row.city}`,
        rent: parseFloat(row.rent_pcm),
        arrears: 0.0,
        days: diffDays,
        lastPaymentDate: lastPayment ? new Date(lastPayment.received_at).toISOString().split('T')[0] : '-'
      };
    }
    tenanciesWithArrears[tenancyId].arrears += parseFloat(row.amount);
  }

  const result = Object.values(tenanciesWithArrears).map(item => ({
    ...item,
    rent: parseFloat(item.rent).toFixed(2),
    arrears: parseFloat(item.arrears).toFixed(2)
  }));

  res.json({
    success: true,
    data: result
  });
});

export const getAllTenants = catchAsync(async (req, res, next) => {
  const tenants = await db('tenants')
    .join('tenancies', 'tenants.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .select(
      'tenants.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'tenancies.id as tenancyId'
    );

  const formatted = [];
  for (const t of tenants) {
    const overdueSchedules = await db('rent_schedules')
      .where('tenancy_id', t.tenancyId)
      .where('status', 'overdue');
    
    let balanceVal = 0.0;
    overdueSchedules.forEach(s => {
      balanceVal -= parseFloat(s.amount);
    });

    formatted.push({
      id: `TNT-${t.id}`,
      rawId: t.id,
      name: t.name,
      email: t.email || '-',
      phone: t.phone || '-',
      property: `${t.address_line1}, ${t.city}`,
      balance: balanceVal,
      status: balanceVal < 0 ? 'In Arrears' : 'Active',
      right_to_rent_status: t.right_to_rent_status || 'pending',
      right_to_rent_expiry: t.right_to_rent_expiry ? new Date(t.right_to_rent_expiry).toISOString().split('T')[0] : null
    });
  }

  res.json({
    success: true,
    data: formatted
  });
});

export const updateTenant = catchAsync(async (req, res, next) => {
  let { id } = req.params;
  if (typeof id === 'string' && id.startsWith('TNT-')) {
    id = id.substring(4);
  }

  const { name, email, phone, right_to_rent_status, right_to_rent_expiry } = req.body;

  const tenantObj = await db('tenants').where('id', id).first();
  if (!tenantObj) {
    throw new ApiError(404, 'Tenant not found');
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (right_to_rent_status !== undefined) updates.right_to_rent_status = right_to_rent_status;
  if (right_to_rent_expiry !== undefined) updates.right_to_rent_expiry = right_to_rent_expiry || null;

  if (Object.keys(updates).length > 0) {
    await db('tenants').where('id', id).update(updates);

    // Audit log
    await db('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'TENANT_UPDATED',
      entity_type: 'tenant',
      entity_id: id,
      meta: JSON.stringify(updates),
      ip_address: req.ip || null
    });
  }

  const updatedTenant = await db('tenants').where('id', id).first();

  res.json({
    success: true,
    data: {
      ...updatedTenant,
      right_to_rent_expiry: updatedTenant.right_to_rent_expiry ? new Date(updatedTenant.right_to_rent_expiry).toISOString().split('T')[0] : null
    }
  });
});

export const deleteTenant = catchAsync(async (req, res, next) => {
  let { id } = req.params;
  if (typeof id === 'string' && id.startsWith('TNT-')) {
    id = id.substring(4);
  }

  const tenant = await db('tenants').where('id', id).first();
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  await db.transaction(async (trx) => {
    await trx('tenants').where('id', id).delete();

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'TENANT_DELETED',
      entity_type: 'tenant',
      entity_id: id,
      meta: JSON.stringify({ name: tenant.name, email: tenant.email }),
      ip_address: req.ip || null
    });
  });

  res.json({
    success: true,
    message: 'Tenant deleted successfully'
  });
});

