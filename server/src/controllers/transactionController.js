import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getMyTransactions = catchAsync(async (req, res, next) => {
  const landlordId = req.user.id;

  const transactions = await db('transactions')
    .where({ landlord_id: landlordId })
    .orderBy('transaction_date', 'desc');

  res.json({
    success: true,
    data: transactions
  });
});
