import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const settingsRouter = Router();

// Secure settings routes - only admin portal and ADMIN role allowed
settingsRouter.use(protect('admin'), restrictTo('ADMIN'));

settingsRouter.route('/')
  .get(getSettings)
  .post(updateSettings);

export default settingsRouter;
