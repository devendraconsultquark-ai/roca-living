import { Router } from 'express';
import {
  getAllLandlords,
  getLandlordById,
  getMyChecklist,
  createLandlord,
  updateLandlordKyc,
  updatePaymentDetails,
  verifyPaymentDetails,
  updateLandlord,
  deleteLandlord
} from '../controllers/landlordController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';
import { validate } from '../middlewares/validate.js';
import { createLandlordSchema } from '../validations/landlordValidation.js';

const landlordRouter = Router();

// Landlord route — declared BEFORE the admin middleware below (and before /:id
// so 'my' is never treated as an id).
landlordRouter.get('/my/checklist', protect('landlord'), restrictTo('LANDLORD'), getMyChecklist);

// Apply admin protection to all remaining routes
landlordRouter.use(protect('admin'), restrictTo('ADMIN'));

landlordRouter.get('/', getAllLandlords);
landlordRouter.post('/', validate(createLandlordSchema), createLandlord);
landlordRouter.get('/:id', getLandlordById);
landlordRouter.patch('/:id/kyc', updateLandlordKyc);
landlordRouter.put('/:id/payment-details', updatePaymentDetails);
landlordRouter.patch('/:id/payment-details/verify', verifyPaymentDetails);
landlordRouter.patch('/:id', updateLandlord);
landlordRouter.delete('/:id', deleteLandlord);

export default landlordRouter;
