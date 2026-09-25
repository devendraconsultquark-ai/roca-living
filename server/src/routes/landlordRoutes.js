import { Router } from 'express';
import {
  getAllLandlords,
  getLandlordById,
  getMyChecklist,
  createLandlord,
  generateActivationLink,
  updateLandlordKyc,
  updatePaymentDetails,
  verifyPaymentDetails,
  updateLandlord,
  deleteLandlord,
  getManagers,
  getLandlordActivity
} from '../controllers/landlordController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';
import { validate } from '../middlewares/validate.js';
import { createLandlordSchema, updateLandlordSchema, updatePaymentDetailsSchema } from '../validations/landlordValidation.js';

import { managedInEstates, rejectEstateFields } from '../middlewares/managedInEstates.js';

// Landlord identity lives in ROCA Estates.
const ESTATE_LANDLORD_FIELDS = ['name', 'email', 'phone', 'address', 'company_name', 'is_overseas', 'ownership_share', 'tob_status', 'kyc_status'];

const landlordRouter = Router();

// Landlord route — declared BEFORE the admin middleware below (and before /:id
// so 'my' is never treated as an id).
landlordRouter.get('/my/checklist', protect('landlord'), restrictTo('LANDLORD'), getMyChecklist);

// Apply admin protection to all remaining routes
landlordRouter.use(protect('admin'), restrictTo('ADMIN'));

landlordRouter.get('/', getAllLandlords);
// Landlords are onboarded in ROCA Estates only (no Roca Living logins either).
landlordRouter.post('/', managedInEstates);
// Static path must precede '/:id' so 'managers' is never parsed as an id
landlordRouter.get('/managers', getManagers);
landlordRouter.get('/:id', getLandlordById);
landlordRouter.get('/:id/activity', getLandlordActivity);
landlordRouter.post('/:id/activation-link', managedInEstates);
landlordRouter.patch('/:id/kyc', updateLandlordKyc);
landlordRouter.put('/:id/payment-details', validate(updatePaymentDetailsSchema), updatePaymentDetails);
landlordRouter.patch('/:id/payment-details/verify', verifyPaymentDetails);
landlordRouter.patch('/:id', rejectEstateFields(ESTATE_LANDLORD_FIELDS), validate(updateLandlordSchema), updateLandlord);
landlordRouter.delete('/:id', managedInEstates);

export default landlordRouter;
