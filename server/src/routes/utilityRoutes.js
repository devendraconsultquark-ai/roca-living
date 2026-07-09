import { Router } from 'express';
import {
  getAllUtilities,
  createUtilityRecord,
  updateUtilityStatus,
  getMyUtilities
} from '../controllers/utilityController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const utilityRouter = Router();

// Landlord routes
utilityRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyUtilities);

// Admin routes for utilities
utilityRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllUtilities);
utilityRouter.post('/', protect('admin'), restrictTo('ADMIN'), createUtilityRecord);
utilityRouter.patch('/:id', protect('admin'), restrictTo('ADMIN'), updateUtilityStatus);

export default utilityRouter;
