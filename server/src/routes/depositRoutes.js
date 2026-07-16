import { Router } from 'express';
import {
  getAllDeposits,
  getDepositsNeedingRegistration,
  updateDeposit
} from '../controllers/depositController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const depositRouter = Router();

// Admin Routes
depositRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllDeposits);
depositRouter.get('/pending', protect('admin'), restrictTo('ADMIN'), getDepositsNeedingRegistration);
depositRouter.patch('/:id', protect('admin'), restrictTo('ADMIN'), updateDeposit);

export default depositRouter;
