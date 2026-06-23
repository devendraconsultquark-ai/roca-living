import { Router } from 'express';
import {
  getAllLandlords,
  getLandlordById,
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

// Apply admin protection to all routes
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
