import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { addDays, toYmd, todayYmd } from '../utils/dateHelpers.js';
import { allocateTenancyPayments } from '../utils/rentAllocation.js';
import { ensureLivingProperty } from '../utils/estatesLink.js';
import { checkPhone } from '../validations/common.js';
import { generateSchedules, firstRentMonth, dueDayOf } from '../utils/rentSchedules.js';
import { findSimilarPayment, paymentDeleteBlocks } from '../utils/rentPayments.js';
import { ensurePropertyCompliance } from '../utils/propertySetup.js';

// Government-approved tenancy deposit schemes (deposits.scheme enum).
const DEPOSIT_SCHEMES = ['TDS', 'DPS', 'mydeposits'];

// Rent due day: 1–28 (every month has it), or empty = the start day. Returns
// the value to store: null when it is the start day anyway.
const cleanRentDueDay = (value, startDate) => {
  if (value === undefined || value === null || value === '') return null;
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 28) throw new ApiError(400, 'Rent due day must be a day of the month from 1 to 28');
  return day === dueDayOf(toYmd(startDate), null) ? null : day;
};

const RENT_PAYMENT_METHODS = ['bank_transfer', 'direct_debit', 'card', 'cash', 'other'];
const ukDate = (d) => { const [y, m, day] = toYmd(d).split('-'); return `${day}/${m}/${y}`; };
const nthDay = (d) => `${d}${[11, 12, 13].includes(d) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[d % 10] || 'th')}`;


// Formatting helpers
const formatTenancy = (t) => {
  if (!t) return null;
  return {
    ...t,
    rent_pcm: t.rent_pcm !== null && t.rent_pcm !== undefined ? parseFloat(t.rent_pcm).toFixed(2) : null,
    agent_letting_fee: t.agent_letting_fee !== null && t.agent_letting_fee !== undefined ? parseFloat(t.agent_letting_fee).toFixed(2) : null,
    roca_letting_fee: t.roca_letting_fee !== null && t.roca_letting_fee !== undefined ? parseFloat(t.roca_letting_fee).toFixed(2) : null,
    start_date: toYmd(t.start_date),
    end_date: toYmd(t.end_date),
    rent_review_date: toYmd(t.rent_review_date),
    proposed_rent: t.proposed_rent !== null && t.proposed_rent !== undefined ? parseFloat(t.proposed_rent).toFixed(2) : null,
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
    received_at: toYmd(d.received_at),
    register_due: toYmd(d.register_due),
    registered_at: toYmd(d.registered_at),
    prescribed_info_served_at: toYmd(d.prescribed_info_served_at),
    created_at: d.created_at ? new Date(d.created_at).toISOString() : null,
    updated_at: d.updated_at ? new Date(d.updated_at).toISOString() : null
  };
};

const formatRentSchedule = (s) => {
  if (!s) return null;
  return {
    ...s,
    amount: s.amount !== null && s.amount !== undefined ? parseFloat(s.amount).toFixed(2) : null,
    due_date: toYmd(s.due_date),
    created_at: s.created_at ? new Date(s.created_at).toISOString() : null
  };
};

const formatRentPayment = (p) => {
  if (!p) return null;
  return {
    ...p,
    amount: p.amount !== null && p.amount !== undefined ? parseFloat(p.amount).toFixed(2) : null,
    received_at: toYmd(p.received_at),
    reconciled_at: p.reconciled_at ? new Date(p.reconciled_at).toISOString() : null,
    created_at: p.created_at ? new Date(p.created_at).toISOString() : null
  };
};

export const createTenancy = catchAsync(async (req, res, next) => {
  const {
    rocaem_property_id,
    start_date,
    end_date,
    rent_pcm,
    frequency,
    agent_letting_fee,
    roca_letting_fee,
    tenants,
    deposit,
    statements_from,
    last_statement_seq,
    rent_due_day
  } = req.body;
  let { property_id } = req.body;

  // Apartments come from ROCA Estates: the internal lettings record for the
  // chosen Rocaem apartment is found or created automatically.
  if (rocaem_property_id) {
    if (!Number.isInteger(Number(rocaem_property_id))) throw new ApiError(400, 'Invalid apartment');
    const { landlord_id: chosenLandlordId, new_landlord: newLandlord } = req.body;
    property_id = await db.transaction((trx) => ensureLivingProperty(trx, Number(rocaem_property_id), {
      landlordId: chosenLandlordId ? Number(chosenLandlordId) : null,
      newLandlord: newLandlord || null
    }));
  }

  if (!property_id) {
    throw new ApiError(400, 'Select an apartment');
  }

  if (!start_date || Number.isNaN(new Date(start_date).getTime())) {
    throw new ApiError(400, 'A valid start_date is required');
  }

  if (rent_pcm === undefined || rent_pcm === null || rent_pcm === '' || Number.isNaN(parseFloat(rent_pcm))) {
    throw new ApiError(400, 'A valid rent_pcm is required');
  }

  const property = await db('properties').where('id', property_id).first();
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  if (!tenants || !Array.isArray(tenants) || tenants.length === 0) {
    throw new ApiError(400, 'At least one tenant is required');
  }

  if (tenants.some(t => !t || !t.name)) {
    throw new ApiError(400, 'Every tenant must have a name');
  }
  tenants.forEach((t, i) => checkPhone(t.phone, tenants.length > 1 ? `Tenant ${i + 1} phone` : 'Tenant phone'));

  // Deposit is optional (details may not be known yet); when given, both the
  // amount and the date received are needed to compute the registration deadline.
  const hasDeposit = !!deposit && deposit.amount !== undefined && deposit.amount !== null && deposit.amount !== '';
  if (hasDeposit && (Number.isNaN(parseFloat(deposit.amount)) || parseFloat(deposit.amount) <= 0 || !deposit.received_at)) {
    throw new ApiError(400, 'Deposit needs a valid amount and the date it was received');
  }
  if (hasDeposit && deposit.scheme && !DEPOSIT_SCHEMES.includes(deposit.scheme)) {
    throw new ApiError(400, `Deposit scheme must be one of ${DEPOSIT_SCHEMES.join(', ')}`);
  }

  // Opening position (optional): tenancy already running and statemented by hand.
  const statementsFrom = statements_from || null;
  if (statementsFrom && (!/^\d{4}-\d{2}-\d{2}$/.test(statementsFrom) || statementsFrom < String(start_date).slice(0, 10))) {
    throw new ApiError(400, 'First period in this system must be a valid date on or after the tenancy start date');
  }
  if (statementsFrom && Number(statementsFrom.slice(8, 10)) !== Number(String(start_date).slice(8, 10))) {
    throw new ApiError(400, 'First period in this system must fall on the rent due day (same day of the month as the start date)');
  }
  const lastSeq = last_statement_seq === undefined || last_statement_seq === null || last_statement_seq === '' ? null : Number(last_statement_seq);
  if (lastSeq !== null && (!Number.isInteger(lastSeq) || lastSeq < 0 || lastSeq > 9999)) {
    throw new ApiError(400, 'Last statement number must be a whole number between 0 and 9999');
  }

  // One live tenancy per property.
  const liveTenancy = await db('tenancies')
    .where('property_id', property_id)
    .whereIn('status', ['active', 'notice', 'pending'])
    .first();
  if (liveTenancy) {
    throw new ApiError(409, 'This property already has a current tenancy — end it before adding a new one');
  }

  // Exactly one lead tenant: the flagged one, else the first listed.
  const rentDueDay = cleanRentDueDay(rent_due_day, start_date);
  const leadIndex = Math.max(0, tenants.findIndex(t => t.is_lead_tenant));

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
      statements_from: statementsFrom,
      last_statement_seq: lastSeq,
      rent_due_day: rentDueDay,
      created_by: req.user.id
    });

    // 2. Insert Tenants
    const tenantRows = tenants.map((t, i) => ({
      tenancy_id: tenancyId,
      name: t.name,
      email: t.email || null,
      phone: t.phone || null,
      is_lead_tenant: i === leadIndex ? 1 : 0,
      right_to_rent_status: 'pending'
    }));
    await trx('tenants').insert(tenantRows);

    // 3. Insert Deposit (optional)
    let depositId = null;
    if (hasDeposit) {
      [depositId] = await trx('deposits').insert({
        tenancy_id: tenancyId,
        holding_deposit: deposit.holding_deposit !== undefined ? parseFloat(deposit.holding_deposit).toFixed(2) : null,
        tenancy_deposit: parseFloat(deposit.amount).toFixed(2),
        scheme: deposit.scheme || 'TDS',
        received_at: deposit.received_at,
        register_due: addDays(deposit.received_at, 30),
        status: 'pending_registration'
      });
    }

    // 4. Generate rent schedules
    const schedules = generateSchedules(start_date, end_date, rent_pcm, statementsFrom, rentDueDay);
    const scheduleRows = schedules.map(s => ({
      tenancy_id: tenancyId,
      due_date: s.due_date,
      amount: s.amount,
      status: 'due'
    }));
    await trx('rent_schedules').insert(scheduleRows);

    // 5. Update property status to 'let'. A flat with a tenant is by definition
    // managed by ROCA Living (RL-003), with its certificates and checklist.
    await trx('properties').where('id', property_id).update({ status: 'let', managed_by_rl: true });
    await ensurePropertyCompliance(trx, property_id);

    // 6. Audit Log
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'TENANCY_CREATED',
      entity_type: 'tenancy',
      entity_id: tenancyId,
      meta: JSON.stringify({ property_id, rent_pcm, deposit_amount: hasDeposit ? deposit.amount : null }),
      ip_address: req.ip || null
    });

    // Fetch full response payload
    const tenancyObj = await trx('tenancies').where('id', tenancyId).first();
    const tenantsList = await trx('tenants').where('tenancy_id', tenancyId);
    const depositObj = depositId ? await trx('deposits').where('id', depositId).first() : null;

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
    .leftJoin('tenants', function() {
      this.on('tenants.tenancy_id', '=', 'tenancies.id').andOn('tenants.is_lead_tenant', '=', db.raw('1'));
    })
    .select(
      'tenancies.*',
      'properties.address_line1',
      'properties.city',
      'properties.postcode',
      'users.name as landlord_name',
      'users.email as landlord_email',
      'tenants.name as lead_tenant_name'
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

// Lifecycle transitions. 'ended' is terminal; 'notice' can be rescinded back
// to 'active' (served in error).
const TENANCY_TRANSITIONS = {
  pending: ['active', 'ended'],
  active: ['notice', 'ended'],
  notice: ['active', 'ended'],
  ended: []
};

// Rent review lifecycle: 'none' (cleared) → 'scheduled' → 'in_progress' → 'completed'.
// "Review Due" is derived client-side (scheduled/in_progress with a past review date).
export const updateRentReview = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { rent_review_date, proposed_rent, rent_review_status } = req.body;

  const tenancy = await db('tenancies').where('id', id).first();
  if (!tenancy) {
    throw new ApiError(404, 'Tenancy not found');
  }

  const status = rent_review_status ?? 'scheduled';
  if (!['none', 'scheduled', 'in_progress', 'completed'].includes(status)) {
    throw new ApiError(400, 'rent_review_status must be none, scheduled, in_progress or completed');
  }

  const updates = { rent_review_status: status };

  if (status === 'none') {
    // Clearing a review removes its date and proposal.
    updates.rent_review_date = null;
    updates.proposed_rent = null;
  } else {
    if (rent_review_date !== undefined) {
      if (rent_review_date && isNaN(new Date(rent_review_date).getTime())) {
        throw new ApiError(400, 'rent_review_date must be a valid date');
      }
      updates.rent_review_date = rent_review_date || null;
    }
    const effectiveDate = updates.rent_review_date !== undefined ? updates.rent_review_date : tenancy.rent_review_date;
    if (!effectiveDate) {
      throw new ApiError(400, 'A review date is required to schedule a rent review');
    }
    if (proposed_rent !== undefined) {
      if (proposed_rent === null || proposed_rent === '') {
        updates.proposed_rent = null;
      } else {
        const rent = parseFloat(proposed_rent);
        if (isNaN(rent) || rent <= 0) {
          throw new ApiError(400, 'proposed_rent must be a positive amount');
        }
        updates.proposed_rent = rent.toFixed(2);
      }
    }
  }

  // Completing a review applies the agreed rent: the tenancy's rent and every
  // rent month due on or after the review date. Months already on a landlord
  // statement keep their amount (an issued statement never changes).
  const completing = status === 'completed' && tenancy.rent_review_status !== 'completed';
  const newRent = updates.proposed_rent !== undefined ? updates.proposed_rent : tenancy.proposed_rent;
  if (completing && !newRent) {
    throw new ApiError(400, 'Enter the agreed new rent to complete the review');
  }

  let applied = null;
  await db.transaction(async (trx) => {
    await trx('tenancies').where('id', id).update({
      ...updates,
      updated_at: trx.fn.now()
    });

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'RENT_REVIEW_UPDATED',
      entity_type: 'tenancy',
      entity_id: id,
      meta: JSON.stringify(updates),
      ip_address: req.ip || null
    });

    if (completing) {
      const fromDate = toYmd(updates.rent_review_date !== undefined ? updates.rent_review_date : tenancy.rent_review_date);
      // Looked up first: MySQL can't update rent_schedules while reading it in a subquery.
      const onStatement = await trx('rent_payment_allocations')
        .join('rent_schedules', 'rent_payment_allocations.schedule_id', 'rent_schedules.id')
        .where('rent_schedules.tenancy_id', id)
        .whereNotNull('rent_payment_allocations.statement_id')
        .distinct('rent_payment_allocations.schedule_id')
        .pluck('rent_payment_allocations.schedule_id');
      const kept = await trx('rent_schedules').where('tenancy_id', id).where('due_date', '>=', fromDate)
        .whereIn('id', onStatement).count('* as n').first();
      const changed = await trx('rent_schedules').where('tenancy_id', id).where('due_date', '>=', fromDate)
        .whereNotIn('id', onStatement).update({ amount: newRent });
      await trx('tenancies').where('id', id).update({ rent_pcm: newRent });
      await allocateTenancyPayments(trx, id);
      applied = { old_rent: parseFloat(tenancy.rent_pcm).toFixed(2), new_rent: parseFloat(newRent).toFixed(2), from: fromDate, months_changed: changed, months_kept: Number(kept?.n || 0) };
      await trx('audit_log').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'RENT_REVIEW_APPLIED',
        entity_type: 'tenancy',
        entity_id: id,
        meta: JSON.stringify(applied),
        ip_address: req.ip || null
      });
    }
  });

  const updated = await db('tenancies').where('id', id).first();
  res.json({
    success: true,
    message: applied
      ? `New rent £${applied.new_rent} applied from ${applied.from} (${applied.months_changed} rent month${applied.months_changed === 1 ? '' : 's'} updated${applied.months_kept ? `, ${applied.months_kept} already on a statement kept` : ''})`
      : 'Rent review saved',
    data: formatTenancy(updated),
    applied
  });
});

// GET /tenancies/rent-preview?start_date=&rent_pcm=&rent_due_day= — what the
// first rent payment will be (pro-rata when the due day isn't the start day).
export const getRentPreview = catchAsync(async (req, res) => {
  const { start_date: start, rent_pcm: rent, rent_due_day: dueDay } = req.query;
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new ApiError(400, 'start_date must be YYYY-MM-DD');
  const amount = parseFloat(rent);
  if (!(amount > 0)) throw new ApiError(400, 'Enter the monthly rent');
  const day = cleanRentDueDay(dueDay, start);
  res.json({ success: true, data: { rent_due_day: dueDayOf(start, day), first_payment: firstRentMonth(start, day, amount) } });
});

// PATCH /tenancies/:id/rent-due-day { rent_due_day } — e.g. the landlord moves
// rent to the 2nd. Rebuilds the tenancy's rent months from the start with the
// pro-rata first payment, then re-applies the payments already received.
// Refused once any statement exists for the tenancy (issued months never change).
// Rent months can only be rebuilt while no statement exists for the tenancy
// (issued statements never change).
const assertNoStatement = async (tenancyId, what) => {
  const statement = await db('landlord_statements').where('tenancy_id', tenancyId).first('statement_number');
  if (statement) {
    throw new ApiError(409, `Statement ${statement.statement_number} already exists for this tenancy, so its rent months can't be rebuilt. Delete the draft first, or keep the current ${what}.`);
  }
};

// Rebuild a tenancy's rent months from its start date, rent and due day, then
// re-allocate the payments already recorded (oldest month first).
const rebuildRentMonths = async (trx, tenancy, { startYmd, rentPcm, dueDay }) => {
  const ids = await trx('rent_schedules').where('tenancy_id', tenancy.id).pluck('id');
  if (ids.length) await trx('rent_payment_allocations').whereIn('schedule_id', ids).delete();
  // Payments point at their first rent month; re-allocation below sets it again.
  await trx('rent_payments').where('tenancy_id', tenancy.id).update({ schedule_id: null });
  await trx('rent_schedules').where('tenancy_id', tenancy.id).delete();
  const rows = generateSchedules(startYmd, tenancy.end_date ? toYmd(tenancy.end_date) : null, rentPcm,
    tenancy.statements_from ? toYmd(tenancy.statements_from) : null, dueDay);
  if (rows.length) await trx('rent_schedules').insert(rows.map((r) => ({ ...r, tenancy_id: tenancy.id })));
  await trx('tenancies').where('id', tenancy.id).update({ start_date: startYmd, rent_pcm: rentPcm, rent_due_day: dueDay, updated_at: trx.fn.now() });
  await allocateTenancyPayments(trx, tenancy.id);
  return rows.length;
};

export const updateRentDueDay = catchAsync(async (req, res) => {
  const tenancy = await db('tenancies').where('id', req.params.id).first();
  if (!tenancy) throw new ApiError(404, 'Tenancy not found');
  await assertNoStatement(tenancy.id, 'due day');
  const startYmd = toYmd(tenancy.start_date);
  const day = cleanRentDueDay(req.body.rent_due_day, startYmd);

  const result = await db.transaction(async (trx) => {
    const months = await rebuildRentMonths(trx, tenancy, { startYmd, rentPcm: tenancy.rent_pcm, dueDay: day });
    const first = firstRentMonth(startYmd, day, parseFloat(tenancy.rent_pcm));
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'RENT_DUE_DAY_CHANGED',
      entity_type: 'tenancy',
      entity_id: tenancy.id,
      meta: JSON.stringify({ from: tenancy.rent_due_day || null, to: day, first_payment: first ? first.amount : null, months }),
      ip_address: req.ip || null
    });
    return { first, months };
  });

  const nth = (d) => `${d}${[11, 12, 13].includes(d) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[d % 10] || 'th')}`;
  const uk = (s) => s.split('-').reverse().join('/');
  res.json({
    success: true,
    message: result.first
      ? `Rent now due on the ${nth(dueDayOf(startYmd, day))} of each month. First payment £${result.first.amount.toFixed(2)} due ${uk(startYmd)} (covers to ${uk(result.first.covered_to)}).`
      : `Rent due on the start day (${nth(dueDayOf(startYmd, day))}) of each month.`,
    data: { rent_due_day: dueDayOf(startYmd, day), first_payment: result.first, months: result.months }
  });
});

// PATCH /tenancies/:id/setup { start_date, rent_pcm, rent_due_day } — correct
// how a tenancy was entered (wrong start date, rent or due day) while no
// statement exists. The rent months are rebuilt; recorded payments are kept
// and re-allocated. After a statement, rent changes go through Rent review.
export const updateTenancySetup = catchAsync(async (req, res) => {
  const tenancy = await db('tenancies').where('id', req.params.id).first();
  if (!tenancy) throw new ApiError(404, 'Tenancy not found');
  await assertNoStatement(tenancy.id, 'start date, rent and due day');
  const b = req.body || {};

  const startYmd = b.start_date === undefined ? toYmd(tenancy.start_date) : String(b.start_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd) || Number.isNaN(new Date(startYmd).getTime())) throw new ApiError(400, 'Enter a valid start date');
  if (tenancy.end_date && startYmd > toYmd(tenancy.end_date)) throw new ApiError(400, 'The start date must be before the end date');
  const rent = b.rent_pcm === undefined ? parseFloat(tenancy.rent_pcm) : parseFloat(b.rent_pcm);
  if (Number.isNaN(rent) || rent <= 0) throw new ApiError(400, 'Rent must be a positive amount');
  const rentPcm = rent.toFixed(2);
  const dueDay = cleanRentDueDay(b.rent_due_day === undefined ? tenancy.rent_due_day : b.rent_due_day, startYmd);

  const before = { start_date: toYmd(tenancy.start_date), rent_pcm: tenancy.rent_pcm, rent_due_day: tenancy.rent_due_day };
  const after = { start_date: startYmd, rent_pcm: rentPcm, rent_due_day: dueDay };
  if (before.start_date === after.start_date && parseFloat(before.rent_pcm) === rent && (before.rent_due_day || null) === dueDay) {
    return res.json({ success: true, message: 'Nothing changed', data: after });
  }

  const months = await db.transaction(async (trx) => {
    const n = await rebuildRentMonths(trx, tenancy, { startYmd, rentPcm, dueDay });
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'TENANCY_SETUP_CORRECTED',
      entity_type: 'tenancy',
      entity_id: tenancy.id,
      meta: JSON.stringify({ before, after, months: n }),
      ip_address: req.ip || null
    });
    return n;
  });
  const first = firstRentMonth(startYmd, dueDay, rent);
  res.json({
    success: true,
    message: `Tenancy updated: starts ${ukDate(startYmd)}, £${rentPcm} pcm, rent due on the ${nthDay(dueDayOf(startYmd, dueDay))}${first ? ` (first payment £${first.amount.toFixed(2)})` : ''}. Rent months rebuilt.`,
    data: { ...after, months, first_payment: first }
  });
});

// POST /tenancies/:id/deposit { amount, received_at, scheme } — a deposit that
// wasn't known when the tenant was added. One deposit per tenancy; it must be
// registered with the scheme within 30 days of being received.
export const addTenancyDeposit = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { amount, received_at: receivedAt, scheme = 'TDS' } = req.body;

  const tenancy = await db('tenancies').where('id', id).first();
  if (!tenancy) throw new ApiError(404, 'Tenancy not found');
  if (await db('deposits').where('tenancy_id', id).first()) {
    throw new ApiError(409, 'This tenancy already has a deposit. Change it on the Deposits page.');
  }
  const value = parseFloat(amount);
  if (Number.isNaN(value) || value <= 0) throw new ApiError(400, 'Enter the deposit amount');
  if (!receivedAt || !/^\d{4}-\d{2}-\d{2}$/.test(receivedAt) || Number.isNaN(new Date(receivedAt).getTime())) {
    throw new ApiError(400, 'Enter the date the deposit was received');
  }
  if (receivedAt > todayYmd()) throw new ApiError(400, 'The date received cannot be in the future');
  if (!DEPOSIT_SCHEMES.includes(scheme)) throw new ApiError(400, `Deposit scheme must be one of ${DEPOSIT_SCHEMES.join(', ')}`);

  const deposit = await db.transaction(async (trx) => {
    const [depositId] = await trx('deposits').insert({
      tenancy_id: Number(id),
      tenancy_deposit: value.toFixed(2),
      scheme,
      received_at: receivedAt,
      register_due: addDays(receivedAt, 30),
      status: 'pending_registration'
    });
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'DEPOSIT_ADDED',
      entity_type: 'tenancy',
      entity_id: id,
      meta: JSON.stringify({ deposit_id: depositId, amount: value.toFixed(2), scheme, received_at: receivedAt }),
      ip_address: req.ip || null
    });
    return trx('deposits').where('id', depositId).first();
  });

  res.status(201).json({ success: true, message: 'Deposit added', data: formatDeposit(deposit) });
});

export const updateTenancy = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, end_date, rent_pcm, rent_frequency } = req.body;

  const tenancy = await db('tenancies').where('id', id).first();
  if (!tenancy) {
    throw new ApiError(404, 'Tenancy not found');
  }

  const updates = {};
  if (status !== undefined && status !== tenancy.status) {
    const allowed = TENANCY_TRANSITIONS[tenancy.status] || [];
    if (!allowed.includes(status)) {
      throw new ApiError(400, `Cannot change tenancy status from '${tenancy.status}' to '${status}'`);
    }
    updates.status = status;
  }
  if (end_date !== undefined) updates.end_date = end_date || null;
  if (rent_pcm !== undefined) {
    const rent = parseFloat(rent_pcm);
    if (isNaN(rent) || rent <= 0) {
      throw new ApiError(400, 'rent_pcm must be a positive amount');
    }
    updates.rent_pcm = rent.toFixed(2);
  }
  if (rent_frequency !== undefined) {
    if (!['monthly', 'weekly'].includes(rent_frequency)) {
      throw new ApiError(400, 'rent_frequency must be monthly or weekly');
    }
    updates.rent_frequency = rent_frequency;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid tenancy fields to update');
  }

  // Ending a tenancy stamps an end date if none was supplied.
  const effectiveEndDate = updates.status === 'ended'
    ? (updates.end_date || tenancy.end_date || todayYmd())
    : null;
  if (updates.status === 'ended' && !updates.end_date && !tenancy.end_date) {
    updates.end_date = effectiveEndDate;
  }

  await db.transaction(async (trx) => {
    await trx('tenancies').where('id', id).update({
      ...updates,
      updated_at: trx.fn.now()
    });

    if (updates.status === 'ended') {
      // Unpaid schedules falling after the end date are no longer owed.
      await trx('rent_schedules')
        .where('tenancy_id', id)
        .where('status', 'due')
        .where('due_date', '>', effectiveEndDate)
        .delete();

      // Free the property when no other live tenancy remains on it.
      const otherLive = await trx('tenancies')
        .where('property_id', tenancy.property_id)
        .whereNot('id', id)
        .whereIn('status', ['active', 'notice', 'pending'])
        .first();
      if (!otherLive) {
        await trx('properties').where('id', tenancy.property_id).update({ status: 'vacant' });
      }
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'TENANCY_UPDATED',
      entity_type: 'tenancy',
      entity_id: id,
      meta: JSON.stringify(updates),
      ip_address: req.ip || null
    });
  });

  const updated = await db('tenancies').where('id', id).first();

  res.json({
    success: true,
    data: formatTenancy(updated)
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
  const { received_at, amount, method, reference, notes, confirm_duplicate } = req.body;

  if (!received_at || !amount || !method) {
    throw new ApiError(400, 'Received date, amount, and method are required');
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new ApiError(400, 'Amount must be a number greater than 0');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(received_at)) || Number.isNaN(new Date(received_at).getTime())) {
    throw new ApiError(400, 'Received date must be a valid date');
  }
  if (!RENT_PAYMENT_METHODS.includes(method)) {
    throw new ApiError(400, 'Choose a valid payment method');
  }

  const tenancy = await db('tenancies').where('id', id).first();
  if (!tenancy) {
    throw new ApiError(404, 'Tenancy not found');
  }

  // The same money may already be here (typed earlier, or reconciled from
  // Xero). The admin has to confirm before it is recorded a second time.
  if (!confirm_duplicate) {
    const similar = await findSimilarPayment(db, id, amountNum, received_at);
    if (similar) {
      throw new ApiError(409, `A £${parseFloat(similar.amount).toFixed(2)} payment on ${ukDate(similar.received_at)} already exists for this tenant. Record it again only if this is a second payment.`, [{
        field: 'duplicate',
        message: 'Possible duplicate payment',
        payment: { id: similar.id, amount: parseFloat(similar.amount).toFixed(2), received_at: toYmd(similar.received_at), reference: similar.reference || null }
      }]);
    }
  }

  const property = await db('properties').where('id', tenancy.property_id).first();

  const result = await db.transaction(async (trx) => {
    const formattedAmount = parseFloat(amount).toFixed(2);

    // 1. Insert rent payment, then apply it to rent months oldest first
    //    (part payments and surplus credit handled by allocateTenancyPayments).
    const [paymentId] = await trx('rent_payments').insert({
      tenancy_id: id,
      schedule_id: null,
      received_at,
      amount: formattedAmount,
      method,
      reference: reference || null,
      reconciled: 0,
      reconciled_by: req.user.id,
      notes: notes || null
    });
    const { credit } = await allocateTenancyPayments(trx, id);
    const allocatedRow = await trx('rent_payments').where('id', paymentId).first();
    const isReconciled = !!allocatedRow.reconciled;
    const matchedSchedule = allocatedRow.schedule_id ? { id: allocatedRow.schedule_id } : null;

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
      matched_schedule_id: matchedSchedule ? matchedSchedule.id : null,
      tenant_credit: credit.toFixed(2)
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

// DELETE /tenancies/rent-payments/:paymentId — remove a hand-typed payment
// entered by mistake. Refused once a statement has paid it out, and for
// payments that came from a Xero bank line (those are undone on that tab).
export const deleteRentPayment = catchAsync(async (req, res) => {
  const paymentId = Number(req.params.paymentId);
  await db.transaction(async (trx) => {
    const payment = await trx('rent_payments').where('id', paymentId).forUpdate().first();
    if (!payment) throw new ApiError(404, 'Payment not found');
    const block = (await paymentDeleteBlocks(trx, [paymentId]))[paymentId];
    if (block) throw new ApiError(409, block);

    // Its ledger line ("rent in" for the same tenancy, amount and date).
    const ledger = await trx('transactions')
      .where({ type: 'rent_in', tenancy_id: payment.tenancy_id, amount: payment.amount })
      .where('transaction_date', toYmd(payment.received_at))
      .whereNotIn('id', trx('xero_bank_transactions').whereNotNull('ledger_transaction_id').select('ledger_transaction_id'))
      .orderBy('id', 'desc')
      .first();
    if (ledger) await trx('transactions').where('id', ledger.id).delete();

    await trx('rent_payments').where('id', paymentId).delete(); // allocations cascade
    await allocateTenancyPayments(trx, payment.tenancy_id);

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'RENT_PAYMENT_DELETED',
      entity_type: 'rent_payment',
      entity_id: paymentId,
      meta: JSON.stringify({ tenancy_id: payment.tenancy_id, amount: parseFloat(payment.amount).toFixed(2), received_at: toYmd(payment.received_at) }),
      ip_address: req.ip || null
    });
  });
  res.json({ success: true, message: 'Payment deleted' });
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
    // 1–2. Payments are applied to rent months oldest first by the allocation
    //      rule; re-running it settles this payment against the open months.
    await trx('rent_payments').where('id', paymentId).update({ reconciled_by: req.user.id });
    await allocateTenancyPayments(trx, payment.tenancy_id);

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
      'deposits.scheme as deposit_scheme',
      'deposits.status as deposit_status',
      'deposits.registered_at as deposit_registered_at',
      'deposits.register_due as deposit_register_due'
    )
    .where('properties.landlord_id', req.user.id)
    .orderBy('tenancies.created_at', 'desc');

  res.json({
    success: true,
    data: list.map(t => {
      // created_by is the internal admin user id — not for landlord consumption.
      const { created_by, ...tenancy } = formatTenancy(t);
      return {
        ...tenancy,
        lead_tenant_name: t.lead_tenant_name || '-',
        deposit_amount: t.deposit_amount !== null && t.deposit_amount !== undefined ? parseFloat(t.deposit_amount).toFixed(2) : null,
        deposit_scheme: t.deposit_scheme || '-',
        deposit_status: t.deposit_status || null,
        deposit_registered_at: toYmd(t.deposit_registered_at),
        deposit_register_due: toYmd(t.deposit_register_due)
      };
    })
  });
});

export const getMyRentSchedule = catchAsync(async (req, res, next) => {
  const schedules = await db('rent_schedules')
    .join('tenancies', 'rent_schedules.tenancy_id', 'tenancies.id')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .select(
      'rent_schedules.id',
      'rent_schedules.tenancy_id',
      'rent_schedules.due_date',
      'rent_schedules.amount',
      'rent_schedules.paid_amount',
      'rent_schedules.status',
      'properties.id as property_id',
      'properties.address_line1',
      'properties.city'
    )
    .where('properties.landlord_id', req.user.id)
    .orderBy('rent_schedules.due_date', 'asc');

  const formatted = schedules.map(s => ({
    ...formatRentSchedule(s),
    property_address: `${s.address_line1}, ${s.city}`
  }));

  const overdue = formatted.filter(s => s.status === 'overdue');
  // Arrears = what is still owed (part-paid months count only the remainder).
  const overdueTotal = overdue.reduce((sum, s) => sum + parseFloat(s.amount || 0) - parseFloat(s.paid_amount || 0), 0);
  let daysInArrears = 0;
  if (overdue.length > 0) {
    const oldest = new Date(overdue[0].due_date);
    daysInArrears = Math.max(0, Math.ceil((Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24)));
  }
  const nextDue = formatted.find(s => s.status === 'due' || s.status === 'partial');

  res.json({
    success: true,
    data: {
      schedules: formatted,
      summary: {
        overdue_count: overdue.length,
        overdue_total: overdueTotal.toFixed(2),
        oldest_overdue_date: overdue.length > 0 ? overdue[0].due_date : null,
        days_in_arrears: daysInArrears,
        next_due_date: nextDue ? nextDue.due_date : null,
        next_due_amount: nextDue ? nextDue.amount : null
      }
    }
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

  const uniqueTenancyIds = [...new Set(arrears.map(row => row.tenancy_id))];
  const lastPaymentsMap = {};

  if (uniqueTenancyIds.length > 0) {
    const lastPayments = await db('rent_payments')
      .whereIn('tenancy_id', uniqueTenancyIds)
      .where('reconciled', 1)
      .whereIn('id', function() {
        this.select(db.raw('MAX(id)'))
          .from('rent_payments')
          .where('reconciled', 1)
          .groupBy('tenancy_id');
      });

    for (const p of lastPayments) {
      lastPaymentsMap[p.tenancy_id] = p;
    }
  }

  const tenanciesWithArrears = {};
  for (const row of arrears) {
    const tenancyId = row.tenancy_id;
    if (!tenanciesWithArrears[tenancyId]) {
      const lastPayment = lastPaymentsMap[tenancyId];

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
        lastPaymentDate: lastPayment ? toYmd(lastPayment.received_at) : '-'
      };
    }
    tenanciesWithArrears[tenancyId].arrears += parseFloat(row.amount) - parseFloat(row.paid_amount || 0);
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

  // Balance as on the tenant page: payments received minus rent fallen due to
  // date (negative = arrears). Counted by date, so it doesn't wait for the
  // overnight job that marks months overdue.
  const tenancyIds = [...new Set(tenants.map(t => t.tenancyId))];
  const dueMap = {};
  const paidMap = {};
  if (tenancyIds.length > 0) {
    const due = await db('rent_schedules')
      .whereIn('tenancy_id', tenancyIds)
      .where('due_date', '<=', db.raw('CURDATE()'))
      .groupBy('tenancy_id')
      .select('tenancy_id')
      .sum('amount as total');
    due.forEach((r) => { dueMap[r.tenancy_id] = parseFloat(r.total || 0); });
    const paid = await db('rent_payments')
      .whereIn('tenancy_id', tenancyIds)
      .groupBy('tenancy_id')
      .select('tenancy_id')
      .sum('amount as total');
    paid.forEach((r) => { paidMap[r.tenancy_id] = parseFloat(r.total || 0); });
  }

  const formatted = [];
  for (const t of tenants) {
    const balanceVal = parseFloat(((paidMap[t.tenancyId] || 0) - (dueMap[t.tenancyId] || 0)).toFixed(2));

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
      right_to_rent_expiry: toYmd(t.right_to_rent_expiry)
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
  checkPhone(phone, 'Tenant phone');

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
      right_to_rent_expiry: toYmd(updatedTenant.right_to_rent_expiry)
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

  // A current tenancy must keep at least one tenant; otherwise it would stay
  // "active" with nobody on it and block the apartment. End the tenancy first.
  const tenancy = await db('tenancies').where('id', tenant.tenancy_id).first();
  const others = await db('tenants').where('tenancy_id', tenant.tenancy_id).whereNot('id', id).orderBy('id');
  if (tenancy && ['active', 'notice', 'pending'].includes(tenancy.status) && others.length === 0) {
    throw new ApiError(409, 'This is the only tenant on a current tenancy. End the tenancy first (Tenancies → End Tenancy), then remove the tenant.');
  }

  await db.transaction(async (trx) => {
    await trx('tenants').where('id', id).delete();
    // Keep exactly one lead tenant on joint tenancies.
    if (tenant.is_lead_tenant && others.length) {
      await trx('tenants').where('id', others[0].id).update({ is_lead_tenant: 1 });
    }

    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'TENANT_DELETED',
      entity_type: 'tenant',
      entity_id: id,
      meta: JSON.stringify({ erased: true }), // name/email intentionally NOT retained
      ip_address: req.ip || null
    });
  });

  res.json({
    success: true,
    message: 'Tenant deleted successfully'
  });
});

export const getTenantById = catchAsync(async (req, res, next) => {
  // Lists show the id as "TNT-12"; accept that form as well as the number.
  const id = String(req.params.id).replace(/^TNT-/i, '');

  const tenant = await db('tenants').where('tenants.id', id).first();
  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  // Tenancy with property info
  const tenancy = await db('tenancies')
    .join('properties', 'tenancies.property_id', 'properties.id')
    .join('users as landlords', 'properties.landlord_id', 'landlords.id')
    .select(
      'tenancies.*',
      'properties.address_line1',
      'properties.address_line2',
      'properties.city',
      'properties.postcode',
      'properties.id as property_id',
      'landlords.name as landlord_name'
    )
    .where('tenancies.id', tenant.tenancy_id)
    .first();

  // Co-tenants in the same tenancy
  const coTenants = await db('tenants')
    .where('tenancy_id', tenant.tenancy_id)
    .whereNot('id', id);

  // Rent payment history (most recent 20)
  const payments = await db('rent_payments')
    .where('tenancy_id', tenant.tenancy_id)
    .orderBy('received_at', 'desc')
    .limit(20);
  const deleteBlocks = await paymentDeleteBlocks(db, payments.map((p) => p.id));

  // Account balance: payments received minus rent fallen due to date
  // (positive = tenant credit, negative = arrears). Future months don't count.
  const scheduleSum = await db('rent_schedules')
    .where('tenancy_id', tenant.tenancy_id)
    .where('due_date', '<=', db.raw('CURDATE()'))
    .sum('amount as total')
    .first();
  const paymentSum = await db('rent_payments')
    .where('tenancy_id', tenant.tenancy_id)
    .sum('amount as total')
    .first();
  const balance = parseFloat(paymentSum?.total || 0) - parseFloat(scheduleSum?.total || 0);
  const deposit = await db('deposits').where('tenancy_id', tenant.tenancy_id).first();
  const hasStatement = !!(await db('landlord_statements').where('tenancy_id', tenant.tenancy_id).first('id'));

  res.json({
    success: true,
    data: {
      ...tenant,
      right_to_rent_expiry: toYmd(tenant.right_to_rent_expiry),
      created_at: tenant.created_at ? new Date(tenant.created_at).toISOString() : null,
      tenancy: tenancy ? {
        ...tenancy,
        start_date: toYmd(tenancy.start_date),
        end_date: toYmd(tenancy.end_date),
        rent_pcm: tenancy.rent_pcm !== null ? parseFloat(tenancy.rent_pcm).toFixed(2) : null,
        property_address: `${tenancy.address_line1}${tenancy.address_line2 ? ', ' + tenancy.address_line2 : ''}, ${tenancy.city} ${tenancy.postcode}`,
        // Day of the month rent falls due, and the pro-rata first payment if any.
        rent_due_day: dueDayOf(toYmd(tenancy.start_date), tenancy.rent_due_day),
        first_payment: firstRentMonth(toYmd(tenancy.start_date), tenancy.rent_due_day, parseFloat(tenancy.rent_pcm)),
        // Start date, rent and due day can be corrected until a statement exists.
        has_statement: hasStatement,
      } : null,
      co_tenants: coTenants,
      deposit: formatDeposit(deposit),
      balance: parseFloat(balance.toFixed(2)),
      payment_history: payments.map(p => ({
        ...p,
        amount: parseFloat(p.amount).toFixed(2),
        received_at: toYmd(p.received_at),
        created_at: p.created_at ? new Date(p.created_at).toISOString() : null,
        // A hand-typed payment no statement has used yet can be deleted.
        can_delete: !deleteBlocks[p.id],
      })),
    }
  });
});

// PATCH /tenancies/:id/opening { last_statement_seq } — the last statement
// number ROCA issued by hand before this system (e.g. 5 for PH_19_0005), so
// numbering continues from there. Can be changed after the tenancy was added.
export const updateTenancyOpening = catchAsync(async (req, res) => {
  const tenancy = await db('tenancies').where('id', req.params.id).first();
  if (!tenancy) throw new ApiError(404, 'Tenancy not found');
  const raw = req.body?.last_statement_seq;
  const seq = raw === null || raw === '' || raw === undefined ? null : Number(raw);
  if (seq !== null && (!Number.isInteger(seq) || seq < 0 || seq > 9999)) {
    throw new ApiError(400, 'Last statement number must be a whole number between 0 and 9999');
  }
  await db.transaction(async (trx) => {
    await trx('tenancies').where('id', tenancy.id).update({ last_statement_seq: seq });
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'TENANCY_OPENING_UPDATED',
      entity_type: 'tenancy',
      entity_id: tenancy.id,
      meta: JSON.stringify({ from: tenancy.last_statement_seq, to: seq }),
      ip_address: req.ip || null
    });
  });
  res.json({ success: true, data: { last_statement_seq: seq } });
});
