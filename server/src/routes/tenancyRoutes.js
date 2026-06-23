import { Router } from 'express';
import {
  createTenancy,
  getAllTenancies,
  getMyTenancies,
  getTenancyById,
  recordRentPayment,
  getRentPayments,
  getAllTenants,
  updateTenant,
  deleteTenant
} from '../controllers/tenancyController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const tenancyRouter = Router();

// Landlord Route - MUST be defined before /:id to prevent routing clash
tenancyRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyTenancies);

// Admin Routes
tenancyRouter.get('/tenants/all', protect('admin'), restrictTo('ADMIN'), getAllTenants);
tenancyRouter.patch('/tenants/:id', protect('admin'), restrictTo('ADMIN'), updateTenant);
tenancyRouter.delete('/tenants/:id', protect('admin'), restrictTo('ADMIN'), deleteTenant);
tenancyRouter.post('/', protect('admin'), restrictTo('ADMIN'), createTenancy);
tenancyRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllTenancies);
tenancyRouter.get('/:id', protect('admin'), restrictTo('ADMIN'), getTenancyById);
tenancyRouter.post('/:id/rent-payments', protect('admin'), restrictTo('ADMIN'), recordRentPayment);
tenancyRouter.get('/:id/rent-payments', protect('admin'), restrictTo('ADMIN'), getRentPayments);

export default tenancyRouter;
