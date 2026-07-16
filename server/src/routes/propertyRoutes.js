import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  updateCertificate,
  uploadCertificateDocument,
  downloadCertificateDocument,
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

// Certificate uploads — PDFs and images only
const certStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync('uploads/certificates/', { recursive: true });
    cb(null, 'uploads/certificates/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, 'cert-' + uniqueSuffix + ext);
  }
});

const certAllowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
const certAllowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];

const certUpload = multer({
  storage: certStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!certAllowedExtensions.includes(ext) || !certAllowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG and PNG certificate files are allowed!'), false);
    }
    cb(null, true);
  }
});

const propertyRouter = Router();

// Landlord routes — /my/certificates MUST precede /my/:id to avoid the param match
propertyRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyProperties);
propertyRouter.get('/my/certificates', protect('landlord'), restrictTo('LANDLORD'), getMyCertificates);
propertyRouter.get('/my/:id', protect('landlord'), restrictTo('LANDLORD'), getMyPropertyById);

// Shared admin/landlord route — landlord ownership enforced in the controller
propertyRouter.get('/:id/certificates/:certType/document', protect(), restrictTo('ADMIN', 'LANDLORD'), downloadCertificateDocument);

// Admin routes
propertyRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllProperties);
propertyRouter.post('/', protect('admin'), restrictTo('ADMIN'), validate(createPropertySchema), createProperty);
propertyRouter.get('/:id', protect('admin'), restrictTo('ADMIN'), getPropertyById);
propertyRouter.patch('/:id', protect('admin'), restrictTo('ADMIN'), updateProperty);
propertyRouter.delete('/:id', protect('admin'), restrictTo('ADMIN'), deleteProperty);
propertyRouter.patch('/:id/certificates/:certType', protect('admin'), restrictTo('ADMIN'), updateCertificate);
propertyRouter.post('/:id/certificates/:certType/document', protect('admin'), restrictTo('ADMIN'), certUpload.single('file'), uploadCertificateDocument);
propertyRouter.patch('/:id/checklist/:itemCode', protect('admin'), restrictTo('ADMIN'), updateChecklistItem);

export default propertyRouter;
