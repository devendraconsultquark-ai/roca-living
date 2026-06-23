import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

// Helper to format date as YYYY-MM-DD
const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toISOString().split('T')[0];
};

export const getArrearsReport = catchAsync(async (req, res, next) => {
  // 1. Group by landlord
  const landlordGroup = await db('rent_schedules')
    .join('tenancies', 'rent_schedules.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .join('users', 'properties.landlord_id', 'users.id')
    .select(
      'users.id as landlord_id',
      'users.name as landlord_name',
      db.raw('SUM(rent_schedules.amount) as total_arrears'),
      db.raw('COUNT(DISTINCT properties.id) as properties_affected'),
      db.raw('MIN(rent_schedules.due_date) as oldest_overdue_date')
    )
    .where('rent_schedules.status', 'overdue')
    .groupBy('users.id', 'users.name')
    .orderBy('total_arrears', 'desc');

  const formattedLandlordGroup = landlordGroup.map(g => ({
    landlord_id: g.landlord_id,
    landlord_name: g.landlord_name,
    total_arrears: parseFloat(g.total_arrears || 0).toFixed(2),
    properties_affected: parseInt(g.properties_affected || 0, 10),
    oldest_overdue_date: formatDate(g.oldest_overdue_date)
  }));

  // 2. Flat list of individual overdue schedules
  const flatSchedules = await db('rent_schedules')
    .join('tenancies', 'rent_schedules.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .join('users', 'properties.landlord_id', 'users.id')
    .select(
      'rent_schedules.id',
      'rent_schedules.tenancy_id',
      'rent_schedules.due_date',
      'rent_schedules.amount',
      'users.name as landlord_name',
      'properties.address_line1',
      'properties.city'
    )
    .where('rent_schedules.status', 'overdue')
    .orderBy('rent_schedules.due_date', 'asc');

  const formattedFlat = flatSchedules.map(s => ({
    id: s.id,
    tenancy_id: s.tenancy_id,
    due_date: formatDate(s.due_date),
    amount: parseFloat(s.amount).toFixed(2),
    landlord_name: s.landlord_name,
    property_address: `${s.address_line1}, ${s.city}`
  }));

  res.json({
    success: true,
    data: {
      landlord_summary: formattedLandlordGroup,
      overdue_schedules: formattedFlat
    }
  });
});

export const getComplianceExpiriesReport = catchAsync(async (req, res, next) => {
  const expiries = await db('property_certificates')
    .join('properties', 'property_certificates.property_id', 'properties.id')
    .join('users', 'properties.landlord_id', 'users.id')
    .select(
      'property_certificates.cert_type',
      'property_certificates.expires_at',
      db.raw('DATEDIFF(property_certificates.expires_at, NOW()) as expires_in_days'),
      db.raw("CONCAT(properties.address_line1, ', ', properties.city) as property_address"),
      'users.name as landlord_name'
    )
    .where('property_certificates.expires_at', '<=', db.raw('DATE_ADD(NOW(), INTERVAL 90 DAY)'))
    .orderBy('property_certificates.expires_at', 'asc');

  const formattedExpiries = expiries.map(e => ({
    cert_type: e.cert_type,
    expires_at: formatDate(e.expires_at),
    expires_in_days: parseInt(e.expires_in_days || 0, 10),
    property_address: e.property_address,
    landlord_name: e.landlord_name
  }));

  res.json({
    success: true,
    data: formattedExpiries
  });
});

export const getPipelineReport = catchAsync(async (req, res, next) => {
  // total_landlords
  const [{ total_landlords }] = await db('users').where('role', 'LANDLORD').count('id as total_landlords');

  // landlord profile stats
  const [{ kyc_pending }] = await db('landlord_profiles').where('kyc_status', 'pending').count('id as kyc_pending');
  const [{ kyc_passed }] = await db('landlord_profiles').where('kyc_status', 'passed').count('id as kyc_passed');
  const [{ tob_signed }] = await db('landlord_profiles').where('tob_status', 'signed').count('id as tob_signed');

  // total_properties and status splits
  const [{ total_properties }] = await db('properties').count('id as total_properties');
  const [{ onboarding_count }] = await db('properties').where('status', 'onboarding').count('id as onboarding_count');
  const [{ vacant_count }] = await db('properties').where('status', 'vacant').count('id as vacant_count');
  const [{ let_count }] = await db('properties').where('status', 'let').count('id as let_count');

  // deposits pending registration
  const [{ deposits_pending_registration }] = await db('deposits').whereNull('registered_at').count('id as deposits_pending_registration');

  // maintenance open & emergency open
  const [{ maintenance_open }] = await db('maintenance_tickets').whereNotIn('status', ['complete', 'cancelled']).count('id as maintenance_open');
  const [{ maintenance_emergency }] = await db('maintenance_tickets').where('urgency', 'emergency').whereNotIn('status', ['complete', 'cancelled']).count('id as maintenance_emergency');

  // rent overdue count & sum
  const rentOverdue = await db('rent_schedules').where('status', 'overdue').select(db.raw('COUNT(id) as cnt, SUM(amount) as total_amount')).first();
  const rent_overdue_count = parseInt(rentOverdue?.cnt || 0, 10);
  const rent_overdue_total_amount = parseFloat(rentOverdue?.total_amount || 0).toFixed(2);

  // statements pending
  const [{ statements_pending }] = await db('landlord_statements').where('status', 'draft').count('id as statements_pending');

  // YTD Revenue: transactions of type 'rent_in' in current calendar year
  const currentYear = new Date().getFullYear();
  const ytdStart = `${currentYear}-01-01`;
  const ytdRevenueRes = await db('transactions')
    .where('type', 'rent_in')
    .andWhere('transaction_date', '>=', ytdStart)
    .sum('amount as ytd_revenue')
    .first();
  const ytd_revenue = parseFloat(ytdRevenueRes?.ytd_revenue || 0).toFixed(2);

  res.json({
    success: true,
    data: {
      total_landlords: parseInt(total_landlords || 0, 10),
      kyc_pending: parseInt(kyc_pending || 0, 10),
      kyc_passed: parseInt(kyc_passed || 0, 10),
      tob_signed: parseInt(tob_signed || 0, 10),
      total_properties: parseInt(total_properties || 0, 10),
      onboarding: parseInt(onboarding_count || 0, 10),
      vacant: parseInt(vacant_count || 0, 10),
      let: parseInt(let_count || 0, 10),
      deposits_pending_registration: parseInt(deposits_pending_registration || 0, 10),
      maintenance_open: parseInt(maintenance_open || 0, 10),
      maintenance_emergency: parseInt(maintenance_emergency || 0, 10),
      rent_overdue_count,
      rent_overdue_total_amount,
      statements_pending: parseInt(statements_pending || 0, 10),
      ytd_revenue
    }
  });
});

export const getDepositsNeedingAttention = catchAsync(async (req, res, next) => {
  const deposits = await db('deposits')
    .join('tenancies', 'deposits.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .select(
      'deposits.*',
      'properties.address_line1',
      'properties.city',
      db.raw('DATEDIFF(deposits.register_due, NOW()) as days_until_due')
    )
    .whereNull('deposits.registered_at')
    .orderBy('deposits.register_due', 'asc');

  const formattedDeposits = deposits.map(d => {
    const days = parseInt(d.days_until_due || 0, 10);
    return {
      id: d.id,
      tenancy_id: d.tenancy_id,
      holding_deposit: d.holding_deposit !== null ? parseFloat(d.holding_deposit).toFixed(2) : null,
      tenancy_deposit: parseFloat(d.tenancy_deposit).toFixed(2),
      scheme: d.scheme,
      received_at: formatDate(d.received_at),
      register_due: formatDate(d.register_due),
      registered_at: formatDate(d.registered_at),
      status: d.status,
      notes: d.notes,
      property_address: `${d.address_line1}, ${d.city}`,
      days_until_due: days,
      urgency_flag: days <= 5 ? 'urgent' : 'normal'
    };
  });

  res.json({
    success: true,
    data: formattedDeposits
  });
});

export const getRecentActivity = catchAsync(async (req, res, next) => {
  const logs = await db('audit_log')
    .orderBy('created_at', 'desc')
    .limit(10);

  const formattedActivities = logs.map(log => {
    let title = log.action.replace(/_/g, ' ');
    // capitalize title
    title = title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
    
    let desc = log.entity_type ? `${log.entity_type} ID #${log.entity_id}` : '';
    let type = 'info';

    // Format title / desc nicely based on action
    if (log.action === 'ONBOARDING_COMPLETED') {
      title = 'Onboarding Completed';
      desc = `Property and tenancy successfully onboarded`;
      type = 'success';
    } else if (log.action === 'PROPERTY_CREATED') {
      title = 'New Property Registered';
      desc = `Property registered successfully`;
      type = 'success';
    } else if (log.action === 'TENANCY_CREATED') {
      title = 'New Tenancy Agreement';
      desc = `Tenancy ID #${log.entity_id} created`;
      type = 'success';
    } else if (log.action === 'RENT_PAYMENT_RECORDED') {
      title = 'Rental Payment Received';
      desc = `Clearance recorded for rental income`;
      type = 'success';
    } else if (log.action === 'RENT_OVERDUE_FLAGGED') {
      title = 'Overdue Rent Alert';
      desc = `Tenant payment has missed its due date`;
      type = 'danger';
    } else if (log.action === 'DEPOSIT_REGISTRATION_REMINDER') {
      title = 'Deposit Registration Warning';
      desc = `Deposit registration deadline is approaching`;
      type = 'danger';
    } else if (log.action === 'MAINTENANCE_TICKET_CREATED') {
      title = 'New Maintenance Ticket';
      desc = `Issue reported for Property ID #${log.entity_id}`;
      type = 'info';
    } else if (log.action === 'COMPLIANCE_CERTIFICATE_STATUS_UPDATED') {
      title = 'Compliance Status Change';
      desc = `Safety certificate is expiring or expired`;
      type = 'danger';
    }

    // Parse meta details if present to make description richer
    try {
      if (log.meta) {
        const meta = typeof log.meta === 'string' ? JSON.parse(log.meta) : log.meta;
        if (log.action === 'RENT_PAYMENT_RECORDED') {
          desc = `£${parseFloat(meta.amount).toFixed(2)} received for tenancy ID #${meta.tenancy_id}`;
        } else if (log.action === 'ONBOARDING_COMPLETED') {
          desc = `Onboarding finished for landlord ID #${meta.landlord_id}, property ID #${meta.property_id}`;
        } else if (log.action === 'RENT_OVERDUE_FLAGGED') {
          desc = `£${parseFloat(meta.amount).toFixed(2)} overdue for tenancy ID #${meta.tenancy_id} (${meta.days_overdue} days)`;
        } else if (log.action === 'PROPERTY_CREATED') {
          desc = `${meta.address_line1 || ''}, ${meta.city || ''}`;
        }
      }
    } catch (err) {
      // ignore
    }

    // Format time (e.g. 10 mins ago, 2 hours ago, or date)
    const diffMs = new Date() - new Date(log.created_at);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeStr = 'Just now';
    if (diffDays > 0) {
      timeStr = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      timeStr = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMins > 0) {
      timeStr = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    }

    return {
      id: log.id,
      title,
      desc,
      time: timeStr,
      type
    };
  });

  res.json({
    success: true,
    data: formattedActivities
  });
});
