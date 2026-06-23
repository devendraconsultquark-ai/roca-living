import { Router } from 'express';
import {
  getUnreconciledPayments,
  manualReconcile,
  getPayments,
  getArrears
} from '../controllers/tenancyController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const accountingRouter = Router();

accountingRouter.get('/unreconciled', protect('admin'), restrictTo('ADMIN'), getUnreconciledPayments);
accountingRouter.patch('/rent-payments/:paymentId/reconcile', protect('admin'), restrictTo('ADMIN'), manualReconcile);
accountingRouter.get('/payments', protect('admin'), restrictTo('ADMIN'), getPayments);
accountingRouter.get('/arrears', protect('admin'), restrictTo('ADMIN'), getArrears);

export default accountingRouter;
