import { Router } from 'express';
import {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  updateCertificate,
  updateChecklistItem,
  getMyProperties,
  getMyPropertyById,
  getMyCertificates,
  deleteProperty
} from '../controllers/propertyController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';
import { validate } from '../middlewares/validate.js';
import { createPropertySchema } from '../validations/propertyValidation.js';

const propertyRouter = Router();

// Landlord routes — /my/certificates MUST precede /my/:id to avoid the param match
propertyRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyProperties);
propertyRouter.get('/my/certificates', protect('landlord'), restrictTo('LANDLORD'), getMyCertificates);
propertyRouter.get('/my/:id', protect('landlord'), restrictTo('LANDLORD'), getMyPropertyById);

// Admin routes
propertyRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllProperties);
propertyRouter.post('/', protect('admin'), restrictTo('ADMIN'), validate(createPropertySchema), createProperty);
propertyRouter.get('/:id', protect('admin'), restrictTo('ADMIN'), getPropertyById);
propertyRouter.patch('/:id', protect('admin'), restrictTo('ADMIN'), updateProperty);
propertyRouter.delete('/:id', protect('admin'), restrictTo('ADMIN'), deleteProperty);
propertyRouter.patch('/:id/certificates/:certType', protect('admin'), restrictTo('ADMIN'), updateCertificate);
propertyRouter.patch('/:id/checklist/:itemCode', protect('admin'), restrictTo('ADMIN'), updateChecklistItem);

export default propertyRouter;
