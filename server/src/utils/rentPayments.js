// Helpers shared by "Record Rent Payment" and the Xero bank reconcile, so the
// same money is not booked twice.

// A recorded payment that looks like the same money: same tenancy, same
// amount, received within `days` of the date (closest first). With
// unlinkedOnly, payments already tied to a Xero bank line are skipped.
export const findSimilarPayment = (conn, tenancyId, amount, dateYmd, { unlinkedOnly = false, days = 7 } = {}) => {
  const q = conn('rent_payments as p')
    .where('p.tenancy_id', tenancyId)
    .where('p.amount', parseFloat(amount).toFixed(2))
    .whereRaw('ABS(DATEDIFF(p.received_at, ?)) <= ?', [dateYmd, days])
    .orderByRaw('ABS(DATEDIFF(p.received_at, ?)), p.id', [dateYmd])
    .select('p.*');
  if (unlinkedOnly) {
    q.whereNotExists(function () {
      this.select(conn.raw('1')).from('xero_bank_transactions as x').whereRaw('x.rent_payment_id = p.id');
    });
  }
  return q.first();
};

// Why each payment can't be deleted: { paymentId: reason }. A payment missing
// from the result can be deleted. Blocked when it is linked to a Xero bank
// line (undo it there) or a statement has already paid it out.
export const paymentDeleteBlocks = async (conn, paymentIds) => {
  const blocks = {};
  if (paymentIds.length === 0) return blocks;
  const linked = await conn('xero_bank_transactions').whereIn('rent_payment_id', paymentIds).select('rent_payment_id');
  for (const x of linked) {
    blocks[x.rent_payment_id] = 'This payment is linked to a Xero bank line — undo it on the Bank Transactions tab';
  }
  const claimed = await conn('rent_payment_allocations as a')
    .join('landlord_statements as s', 'a.statement_id', 's.id')
    .whereIn('a.payment_id', paymentIds)
    .select('a.payment_id', 's.statement_number');
  for (const c of claimed) {
    blocks[c.payment_id] = `Statement ${c.statement_number} already includes this payment — it can't be deleted`;
  }
  return blocks;
};
