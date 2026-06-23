import { Router } from 'express';
import {
  getDepositsNeedingRegistration,
  updateDeposit
} from '../controllers/depositController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const depositRouter = Router();

// Admin Routes
depositRouter.get('/pending', protect('admin'), restrictTo('ADMIN'), getDepositsNeedingRegistration);
depositRouter.patch('/:id', protect('admin'), restrictTo('ADMIN'), updateDeposit);

export default depositRouter;
