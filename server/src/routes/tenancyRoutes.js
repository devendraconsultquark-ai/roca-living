import { Router } from 'express';
import {
  createTenancy,
  getAllTenancies,
  getMyTenancies,
  getMyRentSchedule,
  getTenancyById,
  updateTenancy,
  updateRentReview,
  addTenancyDeposit,
  getRentPreview,
  updateRentDueDay,
  updateTenancySetup,
  recordRentPayment,
  getRentPayments,
  deleteRentPayment,
  getAllTenants,
  updateTenant,
  deleteTenant,
  updateTenancyOpening,
  getTenantById
} from '../controllers/tenancyController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const tenancyRouter = Router();

// Landlord Routes - MUST be defined before /:id to prevent routing clash
tenancyRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyTenancies);
tenancyRouter.get('/my/rent-schedule', protect('landlord'), restrictTo('LANDLORD'), getMyRentSchedule);

// Admin Routes
tenancyRouter.get('/tenants/all', protect('admin'), restrictTo('ADMIN'), getAllTenants);
tenancyRouter.get('/tenants/:id', protect('admin'), restrictTo('ADMIN'), getTenantById);
tenancyRouter.patch('/tenants/:id', protect('admin'), restrictTo('ADMIN'), updateTenant);
tenancyRouter.delete('/tenants/:id', protect('admin'), restrictTo('ADMIN'), deleteTenant);
tenancyRouter.delete('/rent-payments/:paymentId', protect('admin'), restrictTo('ADMIN'), deleteRentPayment);
tenancyRouter.post('/', protect('admin'), restrictTo('ADMIN'), createTenancy);
tenancyRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllTenancies);
tenancyRouter.get('/rent-preview', protect('admin'), restrictTo('ADMIN'), getRentPreview);
tenancyRouter.get('/:id', protect('admin'), restrictTo('ADMIN'), getTenancyById);
tenancyRouter.patch('/:id/opening', protect('admin'), restrictTo('ADMIN'), updateTenancyOpening);
tenancyRouter.patch('/:id', protect('admin'), restrictTo('ADMIN'), updateTenancy);
tenancyRouter.patch('/:id/rent-review', protect('admin'), restrictTo('ADMIN'), updateRentReview);
tenancyRouter.patch('/:id/rent-due-day', protect('admin'), restrictTo('ADMIN'), updateRentDueDay);
tenancyRouter.patch('/:id/setup', protect('admin'), restrictTo('ADMIN'), updateTenancySetup);
tenancyRouter.post('/:id/deposit', protect('admin'), restrictTo('ADMIN'), addTenancyDeposit);
tenancyRouter.post('/:id/rent-payments', protect('admin'), restrictTo('ADMIN'), recordRentPayment);
tenancyRouter.get('/:id/rent-payments', protect('admin'), restrictTo('ADMIN'), getRentPayments);

export default tenancyRouter;
