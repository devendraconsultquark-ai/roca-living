import { Router } from 'express';
import {
  getArrearsReport,
  getComplianceExpiriesReport,
  getPipelineReport,
  getDepositsNeedingAttention,
  getRecentActivity
} from '../controllers/reportController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const reportRouter = Router();

// Apply auth middleware to all report routes
reportRouter.use(protect('admin'), restrictTo('ADMIN'));

reportRouter.get('/arrears', getArrearsReport);
reportRouter.get('/compliance-expiries', getComplianceExpiriesReport);
reportRouter.get('/pipeline', getPipelineReport);
reportRouter.get('/deposits', getDepositsNeedingAttention);
reportRouter.get('/recent-activity', getRecentActivity);

export default reportRouter;
