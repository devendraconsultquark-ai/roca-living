import db from '../config/db.js';
import { addMonths, toYmd, todayYmd } from './dateHelpers.js';
import { allocateTenancyPayments } from './rentAllocation.js';

// ── Rent due day and the pro-rata first payment ─────────────────────────────
// Rent is due on the tenancy's start day each month, unless a different "rent
// due day" is set (e.g. moved in 22 Aug, rent due on the 2nd). Then the first
// payment, due on the start date, covers the odd days up to the day before the
// first due day (pro-rata at each calendar month's daily rate: rent ÷ days in
// that month × days) plus one full month; full rent follows on the due day.
// Example: start 22 Aug, due 2nd, £595 → £191.94 (22–31 Aug) + £19.83 (1 Sep)
// + £595 (2 Sep – 1 Oct) = £806.77 due 22 Aug; then £595 on 2 Oct, 2 Nov…

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const ymdDate = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d); };
const dayBefore = (ymd) => { const d = ymdDate(ymd); d.setDate(d.getDate() - 1); return toYmd(d); };

// The day rent falls due each month (1–28), or the start day.
export const dueDayOf = (startYmd, rentDueDay) => Number(rentDueDay) || ymdDate(startYmd).getDate();

// Pro-rata rent from fromYmd to toYmd (both included), month by month.
export const proRataRent = (fromYmd, toYmd2, rentPcm) => {
  const segments = [];
  let cur = ymdDate(fromYmd);
  const last = ymdDate(toYmd2);
  while (cur <= last) {
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const segEnd = monthEnd < last ? monthEnd : last;
    const days = segEnd.getDate() - cur.getDate() + 1;
    const daysInMonth = monthEnd.getDate();
    segments.push({ from: toYmd(cur), to: toYmd(segEnd), days, days_in_month: daysInMonth, amount: round2(rentPcm / daysInMonth * days) });
    cur = new Date(segEnd.getFullYear(), segEnd.getMonth(), segEnd.getDate() + 1);
  }
  return { segments, total: round2(segments.reduce((s, x) => s + x.amount, 0)) };
};

// The first rent payment when the due day differs from the start day, or null.
export const firstRentMonth = (startYmd, rentDueDay, rentPcm) => {
  const startDay = ymdDate(startYmd).getDate();
  const dueDay = dueDayOf(startYmd, rentDueDay);
  if (dueDay === startDay) return null;
  const s = ymdDate(startYmd);
  let firstDue = new Date(s.getFullYear(), s.getMonth(), dueDay);
  if (firstDue <= s) firstDue = new Date(s.getFullYear(), s.getMonth() + 1, dueDay);
  const firstDueYmd = toYmd(firstDue);
  const nextDue = addMonths(firstDueYmd, 1);
  const rent = round2(rentPcm);
  const proRata = proRataRent(startYmd, dayBefore(firstDueYmd), rent);
  return {
    due_date: startYmd,
    amount: round2(proRata.total + rent),
    pro_rata: proRata,
    full_month: { from: firstDueYmd, to: dayBefore(nextDue), amount: rent },
    covered_to: dayBefore(nextDue),
    next_due: nextDue,
    due_day: dueDay
  };
};

// Statement period starting on startYmd: to the day before the next due day,
// except the first period of a pro-rata tenancy, which runs to the end of the
// first payment's cover (22 Aug – 1 Oct in the example above).
export const rentPeriodFor = (periodStartYmd, tenancyStartYmd, rentDueDay) => {
  const plan = firstRentMonth(tenancyStartYmd, rentDueDay, 0);
  if (plan && periodStartYmd === tenancyStartYmd) return { start: periodStartYmd, end: plan.covered_to };
  const dueDay = dueDayOf(tenancyStartYmd, rentDueDay);
  const s = ymdDate(periodStartYmd);
  const nextDue = new Date(s.getFullYear(), s.getMonth() + 1, Math.min(dueDay, new Date(s.getFullYear(), s.getMonth() + 2, 0).getDate()));
  nextDue.setDate(nextDue.getDate() - 1);
  return { start: periodStartYmd, end: toYmd(nextDue) };
};

// Monthly rent months on the tenancy's due day. With fromDateStr (a tenancy
// already running before this system), months due before it are skipped and
// the 12-month horizon counts from it. With a rent due day other than the
// start day, the first month is the pro-rata payment above.
export const generateSchedules = (startDateStr, endDateStr, rentPcm, fromDateStr = null, rentDueDay = null) => {
  const schedules = [];
  const end = endDateStr ? new Date(endDateStr) : null;
  const from = fromDateStr ? new Date(fromDateStr) : null;
  const plan = firstRentMonth(toYmd(startDateStr), rentDueDay, parseFloat(rentPcm));
  if (plan && !(from && new Date(plan.due_date) < from)) {
    schedules.push({ due_date: plan.due_date, amount: plan.amount.toFixed(2), status: 'due' });
  }
  const seriesStart = plan ? plan.next_due : startDateStr;

  let i = 0;
  while (true) {
    const nextDateStr = addMonths(seriesStart, i);
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
  // Months fall on the rent due day (after a pro-rata first payment, from its next due date).
  const plan = firstRentMonth(start, tenancy.rent_due_day, parseFloat(tenancy.rent_pcm));
  const seriesStart = plan ? plan.next_due : start;

  const rows = [];
  for (let i = 0; i < 1200; i++) {
    const due = addMonths(seriesStart, i);
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
