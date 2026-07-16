import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

const formatTransaction = (t) => ({
  ...t,
  amount: t.amount !== null && t.amount !== undefined ? parseFloat(t.amount).toFixed(2) : null,
  transaction_date: t.transaction_date ? new Date(t.transaction_date).toISOString().split('T')[0] : null,
  created_at: t.created_at ? new Date(t.created_at).toISOString() : null
});

export const getMyTransactions = catchAsync(async (req, res, next) => {
  const landlordId = req.user.id;

  const transactions = await db('transactions')
    .leftJoin('properties', 'transactions.property_id', 'properties.id')
    .select(
      'transactions.*',
      'properties.address_line1 as property_address',
      'properties.city as property_city'
    )
    .where('transactions.landlord_id', landlordId)
    .orderBy('transactions.transaction_date', 'desc');

  res.json({
    success: true,
    // created_by is the internal admin user id — not for landlord consumption.
    data: transactions.map(({ created_by, ...t }) => formatTransaction(t))
  });
});

export const getAllTransactions = catchAsync(async (req, res, next) => {
  const { type, property_id, landlord_id, from, to } = req.query;

  let query = db('transactions')
    .leftJoin('properties', 'transactions.property_id', 'properties.id')
    .leftJoin('users', 'transactions.landlord_id', 'users.id')
    .select(
      'transactions.*',
      'properties.address_line1 as property_address',
      'properties.city as property_city',
      'users.name as landlord_name'
    )
    .orderBy('transactions.transaction_date', 'desc')
    .orderBy('transactions.id', 'desc');

  if (type) {
    query.where('transactions.type', type);
  }
  if (property_id) {
    query.where('transactions.property_id', property_id);
  }
  if (landlord_id) {
    query.where('transactions.landlord_id', landlord_id);
  }
  if (from) {
    query.where('transactions.transaction_date', '>=', from);
  }
  if (to) {
    query.where('transactions.transaction_date', '<=', to);
  }

  const transactions = await query;

  res.json({
    success: true,
    data: transactions.map(formatTransaction)
  });
});
