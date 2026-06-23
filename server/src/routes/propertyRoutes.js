import { Router } from 'express';
import {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  updateCertificate,
  getMyProperties,
  getMyPropertyById,
  deleteProperty
} from '../controllers/propertyController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';
import { validate } from '../middlewares/validate.js';
import { createPropertySchema } from '../validations/propertyValidation.js';

const propertyRouter = Router();

// Landlord routes
propertyRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyProperties);
propertyRouter.get('/my/:id', protect('landlord'), restrictTo('LANDLORD'), getMyPropertyById);

// Admin routes
propertyRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllProperties);
propertyRouter.post('/', protect('admin'), restrictTo('ADMIN'), validate(createPropertySchema), createProperty);
propertyRouter.get('/:id', protect('admin'), restrictTo('ADMIN'), getPropertyById);
propertyRouter.patch('/:id', protect('admin'), restrictTo('ADMIN'), updateProperty);
propertyRouter.delete('/:id', protect('admin'), restrictTo('ADMIN'), deleteProperty);
propertyRouter.patch('/:id/certificates/:certType', protect('admin'), restrictTo('ADMIN'), updateCertificate);

export default propertyRouter;
