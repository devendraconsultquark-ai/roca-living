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

  // 2. Flat list of individual overdue schedules (with lead tenant for the arrears view)
  const leadTenants = db('tenants')
    .select('tenancy_id', db.raw('MAX(name) as tenant_name'))
    .where('is_lead_tenant', 1)
    .groupBy('tenancy_id')
    .as('lt');

  const flatSchedules = await db('rent_schedules')
    .join('tenancies', 'rent_schedules.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .join('users', 'properties.landlord_id', 'users.id')
    .leftJoin(leadTenants, 'lt.tenancy_id', 'rent_schedules.tenancy_id')
    .select(
      'rent_schedules.id',
      'rent_schedules.tenancy_id',
      'rent_schedules.due_date',
      'rent_schedules.amount',
      'users.name as landlord_name',
      'lt.tenant_name',
      'properties.address_line1',
      'properties.city',
      db.raw('DATEDIFF(CURDATE(), rent_schedules.due_date) as days_overdue')
    )
    .where('rent_schedules.status', 'overdue')
    .orderBy('rent_schedules.due_date', 'asc');

  const formattedFlat = flatSchedules.map(s => ({
    id: s.id,
    tenancy_id: s.tenancy_id,
    due_date: formatDate(s.due_date),
    amount: parseFloat(s.amount).toFixed(2),
    landlord_name: s.landlord_name,
    tenant_name: s.tenant_name || null,
    days_overdue: parseInt(s.days_overdue || 0, 10),
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

export const getDashboardSummary = catchAsync(async (req, res, next) => {
  // Calendar-month boundaries (YYYY-MM-DD, half-open interval). Month-scoped
  // figures (rent due/collected, payouts, fees, "new this month") follow
  // ?month=YYYY-MM; snapshot figures (totals, arrears, compliance, alerts)
  // always reflect the live position.
  const { month } = req.query;
  let base = new Date();
  if (month !== undefined) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) {
      throw new ApiError(400, 'month must be in YYYY-MM format');
    }
    const [y, m] = String(month).split('-').map(Number);
    base = new Date(y, m - 1, 1);
  }
  const pad = (n) => String(n).padStart(2, '0');
  const monthStart = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-01`;
  const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const nextMonthStart = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01`;

  const inMonth = (qb, col) => qb.where(col, '>=', monthStart).andWhere(col, '<', nextMonthStart);

  const [
    landlordCounts,
    propertyCounts,
    tenancyActive,
    rentDueMonth,
    rentCollectedMonth,
    payoutsMonth,
    statementsPending,
    arrears,
    unreconciledReceipts,
    mgmtFeesMonth,
    contractorCostsMonth,
    certBuckets,
    maintByStatus,
    maintUrgentOpen,
    maintAwaitingInvoice,
    topArrears,
    rentReviews,
    newsItems,
    certAlerts,
    depositAlerts,
    maintenanceAlerts,
    paymentAlerts
  ] = await Promise.all([
    db('users').where('role', 'LANDLORD').select(
      db.raw('COUNT(id) as total'),
      db.raw('SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new_this_month', [monthStart])
    ).first(),
    db('properties').select(
      db.raw('COUNT(id) as total'),
      db.raw('SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new_this_month', [monthStart]),
      db.raw("SUM(CASE WHEN status = 'let' THEN 1 ELSE 0 END) as let_count")
    ).first(),
    db('tenancies').where('status', 'active').count('id as cnt').first(),
    inMonth(db('rent_schedules'), 'due_date').sum('amount as total').first(),
    inMonth(db('rent_payments'), 'received_at').sum('amount as total').first(),
    inMonth(db('transactions').where('type', 'landlord_payout'), 'transaction_date').sum('amount as total').first(),
    db('landlord_statements').whereNot('status', 'paid').select(
      db.raw('COUNT(id) as cnt'),
      db.raw('SUM(net_paid) as total')
    ).first(),
    db('rent_schedules').where('status', 'overdue').select(
      db.raw('COUNT(id) as cnt'),
      db.raw('SUM(amount) as total')
    ).first(),
    db('rent_payments').where('reconciled', 0).sum('amount as total').first(),
    inMonth(db('transactions').where('type', 'mgmt_fee'), 'transaction_date').sum('amount as total').first(),
    inMonth(db('transactions').where('type', 'contractor_cost'), 'transaction_date').sum('amount as total').first(),
    db('property_certificates').select(
      db.raw('COUNT(id) as total'),
      db.raw('SUM(CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END) as not_uploaded'),
      db.raw('SUM(CASE WHEN expires_at < CURDATE() THEN 1 ELSE 0 END) as overdue'),
      db.raw('SUM(CASE WHEN expires_at >= CURDATE() AND expires_at <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as due_30'),
      db.raw('SUM(CASE WHEN expires_at > DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND expires_at <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 1 ELSE 0 END) as due_60'),
      db.raw('SUM(CASE WHEN expires_at > DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 1 ELSE 0 END) as compliant')
    ).first(),
    db('maintenance_tickets').select('status').count('id as cnt').groupBy('status'),
    db('maintenance_tickets')
      .whereIn('urgency', ['emergency', 'urgent'])
      .whereNotIn('status', ['complete', 'cancelled'])
      .count('id as cnt').first(),
    db('maintenance_tickets').where('status', 'complete').whereNull('invoice_document_id').count('id as cnt').first(),
    db
      .from(
        db('rent_schedules')
          .select('tenancy_id')
          .sum('amount as arrears')
          .where('status', 'overdue')
          .groupBy('tenancy_id')
          .as('a')
      )
      .join('tenancies', 'a.tenancy_id', 'tenancies.id')
      .join('properties', 'tenancies.property_id', 'properties.id')
      .leftJoin('tenants', 'tenants.tenancy_id', 'tenancies.id')
      .groupBy('a.tenancy_id', 'a.arrears', 'properties.address_line1', 'properties.city')
      .select(
        'a.tenancy_id',
        'a.arrears',
        db.raw('MAX(CASE WHEN tenants.is_lead_tenant = 1 THEN tenants.name END) as lead_tenant'),
        db.raw('MAX(tenants.name) as any_tenant'),
        'properties.address_line1',
        'properties.city'
      )
      .orderBy('a.arrears', 'desc')
      .limit(5),
    db('tenancies')
      .join('properties', 'tenancies.property_id', 'properties.id')
      .whereIn('tenancies.rent_review_status', ['scheduled', 'in_progress'])
      .whereNotNull('tenancies.rent_review_date')
      .whereIn('tenancies.status', ['active', 'notice'])
      .select(
        'tenancies.id',
        'tenancies.rent_pcm',
        'tenancies.rent_review_date',
        'tenancies.proposed_rent',
        'tenancies.rent_review_status',
        'properties.address_line1',
        'properties.city'
      )
      .orderBy('tenancies.rent_review_date', 'asc')
      .limit(5),
    db('news_items')
      .where('status', 'active')
      .orderBy('published_on', 'desc')
      .orderBy('id', 'desc')
      .limit(5),
    db('property_certificates')
      .join('properties', 'property_certificates.property_id', 'properties.id')
      .select(
        'property_certificates.cert_type',
        db.raw("CONCAT(properties.address_line1, ', ', properties.city) as related_to"),
        db.raw('DATEDIFF(property_certificates.expires_at, CURDATE()) as days_left')
      )
      .whereNotNull('property_certificates.expires_at')
      .where('property_certificates.expires_at', '<=', db.raw('DATE_ADD(CURDATE(), INTERVAL 30 DAY)'))
      .orderBy('property_certificates.expires_at', 'asc')
      .limit(25),
    db('deposits')
      .join('tenancies', 'deposits.tenancy_id', 'tenancies.id')
      .join('properties', 'tenancies.property_id', 'properties.id')
      .select(
        db.raw("CONCAT(properties.address_line1, ', ', properties.city) as related_to"),
        db.raw('DATEDIFF(deposits.register_due, CURDATE()) as days_left')
      )
      .whereNull('deposits.registered_at')
      .orderBy('deposits.register_due', 'asc')
      .limit(25),
    db('maintenance_tickets')
      .join('properties', 'maintenance_tickets.property_id', 'properties.id')
      .select(
        'maintenance_tickets.title',
        'maintenance_tickets.urgency',
        'maintenance_tickets.status',
        db.raw("CONCAT(properties.address_line1, ', ', properties.city) as related_to")
      )
      .whereIn('maintenance_tickets.urgency', ['emergency', 'urgent'])
      .whereNotIn('maintenance_tickets.status', ['complete', 'cancelled'])
      .orderBy(db.raw("FIELD(maintenance_tickets.urgency, 'emergency', 'urgent')"))
      .orderBy('maintenance_tickets.created_at', 'asc')
      .limit(25),
    db('landlord_statements')
      .join('users', 'landlord_statements.landlord_id', 'users.id')
      .select('landlord_statements.status', 'users.name as related_to')
      .whereNot('landlord_statements.status', 'paid')
      .orderBy('landlord_statements.period_end', 'asc')
      .limit(25)
  ]);

  const num = (v) => parseFloat(v || 0);
  const int = (v) => parseInt(v || 0, 10);

  const statusCounts = Object.fromEntries(maintByStatus.map((r) => [r.status, int(r.cnt)]));
  const rentDue = num(rentDueMonth?.total);
  const rentCollected = num(rentCollectedMonth?.total);

  // Operational alerts derived from live data (no separate task system exists).
  const CERT_LABELS = {
    GAS: 'Gas Safety', EICR: 'EICR', EPC: 'EPC',
    SMOKE_CO: 'Smoke & CO alarm', HMO: 'HMO licence', PAT: 'PAT'
  };
  const dueLabel = (days) => (days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days} days`);
  const alerts = [
    ...certAlerts.map((c) => {
      const days = int(c.days_left);
      return {
        type: 'compliance',
        description: `${CERT_LABELS[c.cert_type] || c.cert_type} certificate ${days < 0 ? 'expired' : `due in ${days} day${days === 1 ? '' : 's'}`}`,
        related_to: c.related_to,
        due: dueLabel(days),
        priority: days < 0 ? 'high' : 'medium',
        status: 'open',
        _sort: days
      };
    }),
    ...depositAlerts.map((d) => {
      const days = int(d.days_left);
      return {
        type: 'deposit',
        description: days < 0 ? 'Deposit protection registration overdue' : 'Deposit protection deadline approaching',
        related_to: d.related_to,
        due: dueLabel(days),
        priority: days <= 5 ? 'high' : 'medium',
        status: 'open',
        _sort: days
      };
    }),
    ...maintenanceAlerts.map((m) => ({
      type: 'maintenance',
      description: m.title,
      related_to: m.related_to,
      due: null,
      priority: m.urgency === 'emergency' ? 'high' : 'medium',
      status: m.status,
      _sort: m.urgency === 'emergency' ? -1000 : 1
    })),
    ...paymentAlerts.map((p) => ({
      type: 'landlord_payment',
      description: 'Landlord payment ready to run',
      related_to: p.related_to,
      due: null,
      priority: 'medium',
      status: p.status === 'draft' ? 'open' : 'sent',
      _sort: 2
    }))
  ].sort((a, b) => a._sort - b._sort);
  const alertsTotal = alerts.length;
  const alertsTop = alerts.slice(0, 8).map(({ _sort, ...rest }) => rest);

  res.json({
    success: true,
    data: {
      kpis: {
        landlords: { total: int(landlordCounts?.total), new_this_month: int(landlordCounts?.new_this_month) },
        properties: { total: int(propertyCounts?.total), new_this_month: int(propertyCounts?.new_this_month) },
        tenancies: {
          active: int(tenancyActive?.cnt),
          // Same formula the pipeline report uses: let / total properties
          occupancy_pct: int(propertyCounts?.total) > 0
            ? +((int(propertyCounts?.let_count) / int(propertyCounts?.total)) * 100).toFixed(1)
            : 0
        },
        rent_due_month: rentDue.toFixed(2),
        rent_collected_month: rentCollected.toFixed(2),
        rent_collected_pct: rentDue > 0 ? +((rentCollected / rentDue) * 100).toFixed(1) : null,
        landlord_payments_month: num(payoutsMonth?.total).toFixed(2),
        statements_pending: int(statementsPending?.cnt)
      },
      financial: {
        rent_due_month: rentDue.toFixed(2),
        rent_collected_month: rentCollected.toFixed(2),
        arrears_total: num(arrears?.total).toFixed(2),
        arrears_count: int(arrears?.cnt),
        landlord_payments_pending: num(statementsPending?.total).toFixed(2),
        unreconciled_receipts: num(unreconciledReceipts?.total).toFixed(2),
        mgmt_fees_month: num(mgmtFeesMonth?.total).toFixed(2),
        contractor_costs_month: num(contractorCostsMonth?.total).toFixed(2)
      },
      compliance: {
        total: int(certBuckets?.total),
        compliant: int(certBuckets?.compliant),
        due_30: int(certBuckets?.due_30),
        due_60: int(certBuckets?.due_60),
        overdue: int(certBuckets?.overdue),
        not_uploaded: int(certBuckets?.not_uploaded),
        pct: int(certBuckets?.total) > 0
          ? Math.round((int(certBuckets?.compliant) / int(certBuckets?.total)) * 100)
          : null
      },
      maintenance: {
        new: statusCounts.new || 0,
        triaged: statusCounts.triaged || 0,
        awaiting_approval: statusCounts.awaiting_approval || 0,
        in_progress: statusCounts.in_progress || 0,
        complete_awaiting_invoice: int(maintAwaitingInvoice?.cnt),
        urgent_open: int(maintUrgentOpen?.cnt)
      },
      top_arrears: topArrears.map((t) => ({
        tenancy_id: t.tenancy_id,
        tenant_name: t.lead_tenant || t.any_tenant || '—',
        property_address: `${t.address_line1}, ${t.city}`,
        amount: num(t.arrears).toFixed(2)
      })),
      rent_reviews: rentReviews.map((r) => ({
        tenancy_id: r.id,
        property_address: `${r.address_line1}, ${r.city}`,
        current_rent: num(r.rent_pcm).toFixed(2),
        review_date: formatDate(r.rent_review_date),
        proposed_rent: r.proposed_rent !== null ? num(r.proposed_rent).toFixed(2) : null,
        status: r.rent_review_status
      })),
      news: newsItems.map((n) => ({
        id: n.id,
        title: n.title,
        url: n.url,
        published_on: formatDate(n.published_on)
      })),
      alerts: {
        total: alertsTotal,
        items: alertsTop
      }
    }
  });
});

// Full certificate register across all properties — powers the Compliance page.
export const getComplianceItems = catchAsync(async (req, res, next) => {
  const items = await db('property_certificates')
    .join('properties', 'property_certificates.property_id', 'properties.id')
    .join('users', 'properties.landlord_id', 'users.id')
    .select(
      'property_certificates.id',
      'property_certificates.property_id',
      'property_certificates.cert_type',
      'property_certificates.issued_at',
      'property_certificates.expires_at',
      'property_certificates.status',
      db.raw('DATEDIFF(property_certificates.expires_at, CURDATE()) as days_left'),
      db.raw("CONCAT(properties.address_line1, ', ', properties.city) as property_address"),
      'users.name as landlord_name',
      'users.id as landlord_id'
    )
    .orderBy(db.raw('property_certificates.expires_at IS NULL'), 'asc')
    .orderBy('property_certificates.expires_at', 'asc');

  res.json({
    success: true,
    data: items.map((i) => ({
      ...i,
      issued_at: formatDate(i.issued_at),
      expires_at: formatDate(i.expires_at),
      days_left: i.days_left !== null ? parseInt(i.days_left, 10) : null
    }))
  });
});

// Monthly transaction sums by type for the trailing 12 months — accounting charts.
export const getCashflow = catchAsync(async (req, res, next) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;

  const rows = await db('transactions')
    .select(
      db.raw("DATE_FORMAT(transaction_date, '%Y-%m') as ym"),
      'type',
      db.raw('SUM(amount) as total')
    )
    .where('transaction_date', '>=', startStr)
    .groupBy('ym', 'type')
    .orderBy('ym', 'asc');

  res.json({
    success: true,
    data: rows.map((r) => ({ ym: r.ym, type: r.type, total: parseFloat(r.total || 0).toFixed(2) }))
  });
});

// Key dates for the Operations Calendar (?month=YYYY-MM, default current month).
// Read-only aggregation of dates the system already tracks.
export const getCalendarEvents = catchAsync(async (req, res, next) => {
  const { month } = req.query;
  let base = new Date();
  if (month !== undefined) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) {
      throw new ApiError(400, 'month must be in YYYY-MM format');
    }
    const [y, m] = String(month).split('-').map(Number);
    base = new Date(y, m - 1, 1);
  }
  const pad = (n) => String(n).padStart(2, '0');
  const monthStart = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-01`;
  const followingMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const monthEnd = `${followingMonth.getFullYear()}-${pad(followingMonth.getMonth() + 1)}-01`;
  const inMonth = (qb, col) => qb.where(col, '>=', monthStart).andWhere(col, '<', monthEnd);

  const [certs, inspections, rents, tenancyEnds, reviews, deposits] = await Promise.all([
    inMonth(
      db('property_certificates')
        .join('properties', 'property_certificates.property_id', 'properties.id')
        .select(
          'property_certificates.cert_type',
          'property_certificates.expires_at as date',
          'properties.id as property_id',
          db.raw("CONCAT(properties.address_line1, ', ', properties.city) as place")
        ),
      'property_certificates.expires_at'
    ),
    inMonth(
      db('inspections')
        .join('properties', 'inspections.property_id', 'properties.id')
        .select(
          'inspections.next_inspection_due as date',
          'properties.id as property_id',
          db.raw("CONCAT(properties.address_line1, ', ', properties.city) as place")
        ),
      'inspections.next_inspection_due'
    ),
    inMonth(
      db('rent_schedules')
        .join('tenancies', 'rent_schedules.tenancy_id', 'tenancies.id')
        .join('properties', 'tenancies.property_id', 'properties.id')
        .select(
          'rent_schedules.due_date as date',
          'rent_schedules.amount',
          'rent_schedules.status',
          'tenancies.id as tenancy_id',
          db.raw("CONCAT(properties.address_line1, ', ', properties.city) as place")
        ),
      'rent_schedules.due_date'
    ),
    inMonth(
      db('tenancies')
        .join('properties', 'tenancies.property_id', 'properties.id')
        .whereIn('tenancies.status', ['active', 'notice'])
        .select(
          'tenancies.end_date as date',
          'tenancies.id as tenancy_id',
          db.raw("CONCAT(properties.address_line1, ', ', properties.city) as place")
        ),
      'tenancies.end_date'
    ),
    inMonth(
      db('tenancies')
        .join('properties', 'tenancies.property_id', 'properties.id')
        .whereIn('tenancies.rent_review_status', ['scheduled', 'in_progress'])
        .select(
          'tenancies.rent_review_date as date',
          'tenancies.id as tenancy_id',
          db.raw("CONCAT(properties.address_line1, ', ', properties.city) as place")
        ),
      'tenancies.rent_review_date'
    ),
    inMonth(
      db('deposits')
        .join('tenancies', 'deposits.tenancy_id', 'tenancies.id')
        .join('properties', 'tenancies.property_id', 'properties.id')
        .whereNull('deposits.registered_at')
        .select(
          'deposits.register_due as date',
          'tenancies.id as tenancy_id',
          db.raw("CONCAT(properties.address_line1, ', ', properties.city) as place")
        ),
      'deposits.register_due'
    )
  ]);

  const events = [
    ...certs.map((c) => ({
      type: 'compliance',
      date: formatDate(c.date),
      title: `${c.cert_type} certificate expires`,
      place: c.place,
      link: `/properties/${c.property_id}`
    })),
    ...inspections.map((i) => ({
      type: 'inspection',
      date: formatDate(i.date),
      title: 'Inspection due',
      place: i.place,
      link: `/properties/${i.property_id}`
    })),
    ...rents.map((r) => ({
      type: 'rent',
      date: formatDate(r.date),
      title: `Rent due £${parseFloat(r.amount).toFixed(2)}${r.status === 'paid' ? ' (paid)' : ''}`,
      place: r.place,
      link: '/accounting'
    })),
    ...tenancyEnds.map((t) => ({
      type: 'tenancy',
      date: formatDate(t.date),
      title: 'Tenancy ends',
      place: t.place,
      link: '/tenancies'
    })),
    ...reviews.map((t) => ({
      type: 'rent_review',
      date: formatDate(t.date),
      title: 'Rent review due',
      place: t.place,
      link: '/rent-reviews'
    })),
    ...deposits.map((d) => ({
      type: 'deposit',
      date: formatDate(d.date),
      title: 'Deposit registration due',
      place: d.place,
      link: '/deposits'
    }))
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  res.json({ success: true, data: events });
});

// Sidebar tile: management fees earned this calendar year (ex VAT), straight
// from the transactions ledger. There is no separate client-account ledger.
export const getMgmtFeeAccount = catchAsync(async (req, res, next) => {
  const year = new Date().getFullYear();
  const row = await db('transactions')
    .where('type', 'mgmt_fee')
    .andWhere('transaction_date', '>=', `${year}-01-01`)
    .sum('amount as total')
    .first();

  res.json({
    success: true,
    data: {
      total: parseFloat(row?.total || 0).toFixed(2),
      year,
      as_at: new Date().toISOString().split('T')[0]
    }
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
