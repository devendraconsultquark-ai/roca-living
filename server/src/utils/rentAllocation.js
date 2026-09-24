// Rent allocation — how tenant money is applied to rent months.
//
// Rule (agreed with ROCA, 24 Sep 2026):
//   • every payment is applied to the tenancy's rent months OLDEST FIRST;
//   • a month can be part-paid (paid_amount < amount) — the rest stays owed;
//   • money beyond the open months (or paying a month not yet due) is the
//     tenant's credit, used automatically against the next rent month;
//   • ROCA's 8% is taken on rent only, on the statement of the month the money
//     pays (so credit is charged when it becomes rent, not when received).
//
// Allocations already included on a landlord statement (statement_id set) are
// frozen: re-allocation only moves the not-yet-statemented money, so an issued
// statement never changes and no money appears on two statements.

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pad2 = (n) => String(n).padStart(2, '0');
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};

// Status of a rent month from what has been paid towards it.
export const scheduleStatus = (amount, paid, dueYmd, today = todayYmd()) => {
  const left = round2(amount - paid);
  if (left <= 0) return 'paid';
  if (dueYmd < today) return 'overdue'; // includes part-paid months past their due date
  return paid > 0 ? 'partial' : 'due';
};

// Re-apply all of a tenancy's payments to its rent months (oldest first).
// Returns { credit } — money received but not applied to any rent month.
export const allocateTenancyPayments = async (trx, tenancyId) => {
  const payments = await trx('rent_payments')
    .where('tenancy_id', tenancyId)
    .orderBy([{ column: 'received_at' }, { column: 'id' }]);
  const schedules = await trx('rent_schedules')
    .where('tenancy_id', tenancyId)
    .orderBy([{ column: 'due_date' }, { column: 'id' }]);
  const paymentIds = payments.map((p) => p.id);

  // Frozen (statemented) allocations stay; the rest is recomputed.
  const frozen = paymentIds.length
    ? await trx('rent_payment_allocations').whereIn('payment_id', paymentIds).whereNotNull('statement_id')
    : [];
  if (paymentIds.length) {
    await trx('rent_payment_allocations').whereIn('payment_id', paymentIds).whereNull('statement_id').delete();
  }

  const frozenByPayment = {};
  const frozenBySchedule = {};
  for (const a of frozen) {
    frozenByPayment[a.payment_id] = round2((frozenByPayment[a.payment_id] || 0) + parseFloat(a.amount));
    frozenBySchedule[a.schedule_id] = round2((frozenBySchedule[a.schedule_id] || 0) + parseFloat(a.amount));
  }

  const months = schedules.map((s) => ({
    id: s.id,
    amount: round2(s.amount),
    due: ymd(s.due_date),
    paid: frozenBySchedule[s.id] || 0,
    oldStatus: s.status,
    oldPaid: round2(s.paid_amount || 0)
  }));

  const inserts = [];
  let i = 0;
  let applied = 0;
  for (const p of payments) {
    let money = round2(parseFloat(p.amount) - (frozenByPayment[p.id] || 0));
    let first = null;
    while (money > 0 && i < months.length) {
      const m = months[i];
      const left = round2(m.amount - m.paid);
      if (left <= 0) { i++; continue; }
      const take = Math.min(money, left);
      inserts.push({ payment_id: p.id, schedule_id: m.id, amount: take.toFixed(2) });
      m.paid = round2(m.paid + take);
      money = round2(money - take);
      applied = round2(applied + take);
      if (first === null) first = m.id;
      if (round2(m.amount - m.paid) <= 0) i++;
    }
    const reconciled = first !== null || (frozenByPayment[p.id] || 0) > 0 ? 1 : 0;
    if ((first !== null && p.schedule_id !== first) || p.reconciled !== reconciled) {
      await trx('rent_payments').where('id', p.id).update({
        schedule_id: first ?? p.schedule_id,
        reconciled,
        reconciled_at: reconciled && !p.reconciled_at ? trx.fn.now() : p.reconciled_at
      });
    }
  }
  if (inserts.length) await trx('rent_payment_allocations').insert(inserts);

  const today = todayYmd();
  for (const m of months) {
    const status = scheduleStatus(m.amount, m.paid, m.due, today);
    if (status !== m.oldStatus || m.paid !== m.oldPaid) {
      await trx('rent_schedules').where('id', m.id).update({ status, paid_amount: m.paid.toFixed(2) });
    }
  }

  const received = round2(payments.reduce((s, p) => s + parseFloat(p.amount), 0));
  const frozenTotal = round2(frozen.reduce((s, a) => s + parseFloat(a.amount), 0));
  return { credit: round2(received - frozenTotal - applied) };
};

// Tenant credit = money received that has not reached a rent month that is
// already due (i.e. unapplied money + money applied to future months).
export const tenancyCredit = async (conn, tenancyId) => {
  const received = await conn('rent_payments').where('tenancy_id', tenancyId).sum('amount as t').first();
  const appliedToDue = await conn('rent_payment_allocations as a')
    .join('rent_schedules as s', 'a.schedule_id', 's.id')
    .where('s.tenancy_id', tenancyId)
    .where('s.due_date', '<=', todayYmd())
    .sum('a.amount as t')
    .first();
  return round2((parseFloat(received?.t) || 0) - (parseFloat(appliedToDue?.t) || 0));
};
