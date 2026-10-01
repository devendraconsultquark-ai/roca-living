import db from '../config/db.js';
import { addMonths, toYmd, todayYmd } from './dateHelpers.js';
import { allocateTenancyPayments } from './rentAllocation.js';

// Monthly rent months on the tenancy's due day. With fromDateStr (a tenancy
// already running before this system), months due before it are skipped and
// the 12-month horizon counts from it.
export const generateSchedules = (startDateStr, endDateStr, rentPcm, fromDateStr = null) => {
  const schedules = [];
  const end = endDateStr ? new Date(endDateStr) : null;
  const from = fromDateStr ? new Date(fromDateStr) : null;

  let i = 0;
  while (true) {
    const nextDateStr = addMonths(startDateStr, i);
    const nextDate = new Date(nextDateStr);

    if (end && nextDate > end) {
      break;
    }
    if (from && nextDate < from) {
      i++;
      continue;
    }
    if (!end && schedules.length >= 12) {
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

// An open-ended tenancy is created with 12 rent months. This adds the months
// that have since come inside the next 12 months (same due day, the tenancy's
// current rent), so rent due, arrears and allocation never run out. Tenancies
// with an end date already have every month up to that date. Returns the
// number of months added.
export const topUpRentSchedules = async (trx, tenancy, today = todayYmd()) => {
  if (tenancy.end_date) return 0;
  const last = await trx('rent_schedules').where('tenancy_id', tenancy.id).max('due_date as d').first();
  if (!last?.d) return 0;
  const lastDue = toYmd(last.d);
  const horizon = addMonths(today, 12);
  const start = toYmd(tenancy.start_date);

  const rows = [];
  for (let i = 0; i < 1200; i++) {
    const due = addMonths(start, i);
    if (due >= horizon) break;
    if (due > lastDue) {
      rows.push({ tenancy_id: tenancy.id, due_date: due, amount: parseFloat(tenancy.rent_pcm).toFixed(2), status: 'due' });
    }
  }
  if (rows.length === 0) return 0;
  await trx('rent_schedules').insert(rows);
  // Tenant credit waiting for a month to pay can now be applied.
  await allocateTenancyPayments(trx, tenancy.id);
  return rows.length;
};

// Nightly job: top up every live open-ended tenancy.
export const topUpAllRentSchedules = async () => {
  const tenancies = await db('tenancies').whereIn('status', ['active', 'notice']).whereNull('end_date');
  let added = 0;
  for (const tenancy of tenancies) {
    added += await db.transaction((trx) => topUpRentSchedules(trx, tenancy));
  }
  return { tenancies: tenancies.length, added };
};
