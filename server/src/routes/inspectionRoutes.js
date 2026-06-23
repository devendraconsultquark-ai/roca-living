import { Router } from 'express';
import {
  createInspection,
  getInspections,
  getMyInspections
} from '../controllers/inspectionController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const inspectionRouter = Router();

// Landlord routes
inspectionRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyInspections);

// Admin routes
inspectionRouter.get('/', protect('admin'), restrictTo('ADMIN'), getInspections);
inspectionRouter.post('/', protect('admin'), restrictTo('ADMIN'), createInspection);

export default inspectionRouter;
