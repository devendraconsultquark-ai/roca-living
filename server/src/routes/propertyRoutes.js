import { Router } from 'express';
import { managedInEstates, rejectEstateFields } from '../middlewares/managedInEstates.js';

// The link to the ROCA Estates apartment (unit codes, owner, reference) is
// fixed; the address printed on statements can be corrected here.
const ESTATE_PROPERTY_FIELDS = ['block_name', 'apartment_number', 'property_reference', 'landlord_id'];
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
  deleteProperty,
  uploadPropertyImage,
  getPropertyImages,
  downloadPropertyImage,
  updatePropertyImage,
  deletePropertyImage
} from '../controllers/propertyController.js';
import {
  listPropertyExpenses,
  addPropertyExpense,
  deletePropertyExpense,
  attachExpenseInvoice,
  downloadExpenseInvoice,
  refreshPropertyFromEstates
} from '../controllers/propertyExpenseController.js';
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

// Supplier invoices behind apartment expenses — PDF / JPG / PNG under uploads/expenses/
const expenseInvoiceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync('uploads/expenses/', { recursive: true });
      cb(null, 'uploads/expenses/');
    },
    filename: (req, file, cb) => {
      cb(null, `expense-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!certAllowedExtensions.includes(ext) || !certAllowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG and PNG invoice files are allowed'), false);
    }
    cb(null, true);
  }
});

// Property photos & floor plans — images only, stored under uploads/properties/
const propertyImageDir = path.join(process.cwd(), 'uploads', 'properties');
if (!fs.existsSync(propertyImageDir)) fs.mkdirSync(propertyImageDir, { recursive: true });

const propertyImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, propertyImageDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    cb(null, 'property-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const allowedImageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const allowedImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const propertyImageUpload = multer({
  storage: propertyImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedImageExts.includes(ext) || !allowedImageMimes.includes(file.mimetype)) {
      return cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'), false);
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
// Static image-download path declared before '/:id' so 'images' is never parsed as an id
propertyRouter.get('/images/:imageId', protect('admin'), restrictTo('ADMIN'), downloadPropertyImage);
propertyRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllProperties);
// Apartments are added/edited in ROCA Estates; the lettings record behind a
// Rocaem apartment is created automatically when a tenant is added.
propertyRouter.post('/', protect('admin'), restrictTo('ADMIN'), managedInEstates);
propertyRouter.get('/:id', protect('admin'), restrictTo('ADMIN'), getPropertyById);
propertyRouter.patch('/:id', protect('admin'), restrictTo('ADMIN'), rejectEstateFields(ESTATE_PROPERTY_FIELDS), updateProperty);
propertyRouter.delete('/:id', protect('admin'), restrictTo('ADMIN'), managedInEstates);
propertyRouter.patch('/:id/certificates/:certType', protect('admin'), restrictTo('ADMIN'), updateCertificate);
propertyRouter.post('/:id/certificates/:certType/document', protect('admin'), restrictTo('ADMIN'), certUpload.single('file'), uploadCertificateDocument);
propertyRouter.patch('/:id/checklist/:itemCode', protect('admin'), restrictTo('ADMIN'), updateChecklistItem);

// Property photos & floor plans (admin)
propertyRouter.post('/:id/images', protect('admin'), restrictTo('ADMIN'), propertyImageUpload.single('image'), uploadPropertyImage);
// Expenses deducted on the landlord statement, and refresh from ROCA Estates.
propertyRouter.get('/:id/expenses', protect('admin'), restrictTo('ADMIN'), listPropertyExpenses);
propertyRouter.post('/:id/expenses', protect('admin'), restrictTo('ADMIN'), expenseInvoiceUpload.single('invoice'), addPropertyExpense);
propertyRouter.post('/:id/expenses/:expenseId/invoice', protect('admin'), restrictTo('ADMIN'), expenseInvoiceUpload.single('invoice'), attachExpenseInvoice);
propertyRouter.get('/:id/expenses/:expenseId/invoice', protect('admin'), restrictTo('ADMIN'), downloadExpenseInvoice);
propertyRouter.delete('/:id/expenses/:expenseId', protect('admin'), restrictTo('ADMIN'), deletePropertyExpense);
propertyRouter.post('/:id/refresh-from-estates', protect('admin'), restrictTo('ADMIN'), refreshPropertyFromEstates);
propertyRouter.get('/:id/images', protect('admin'), restrictTo('ADMIN'), getPropertyImages);
propertyRouter.patch('/:id/images/:imageId', protect('admin'), restrictTo('ADMIN'), updatePropertyImage);
propertyRouter.delete('/:id/images/:imageId', protect('admin'), restrictTo('ADMIN'), deletePropertyImage);

export default propertyRouter;
