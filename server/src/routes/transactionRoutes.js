import { Router } from 'express';
import { getMyTransactions, getAllTransactions } from '../controllers/transactionController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const transactionRouter = Router();

transactionRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyTransactions);
transactionRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllTransactions);

export default transactionRouter;
