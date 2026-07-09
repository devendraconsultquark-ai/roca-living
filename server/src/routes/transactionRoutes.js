import { Router } from 'express';
import { getMyTransactions } from '../controllers/transactionController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const transactionRouter = Router();

transactionRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyTransactions);

export default transactionRouter;
