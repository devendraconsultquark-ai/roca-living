import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  createTicket,
  updateTicketStatus,
  getAllTickets,
  getMyTickets,
  approveQuote,
  declineQuote,
  uploadTicketImage,
  getTicketImages,
  downloadTicketImage,
  getAllContractors,
  createContractor,
  updateContractor,
  deleteContractor,
  getContractorById
} from '../controllers/maintenanceController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

// Image uploads for maintenance tickets — images only, stored under uploads/maintenance/
const imageDir = path.join(process.cwd(), 'uploads', 'maintenance');
if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imageDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    cb(null, 'ticket-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const allowedImageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const allowedImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedImageExts.includes(ext) || !allowedImageMimes.includes(file.mimetype)) {
      return cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'), false);
    }
    cb(null, true);
  }
});

const maintenanceRouter = Router();

// General routes (accessible by both Admin and Landlord)
maintenanceRouter.post('/', protect(), restrictTo('ADMIN', 'LANDLORD'), createTicket);

// Ticket images (shared; landlord ownership enforced in controller)
maintenanceRouter.post('/:id/images', protect(), restrictTo('ADMIN', 'LANDLORD'), imageUpload.single('image'), uploadTicketImage);
maintenanceRouter.get('/:id/images', protect(), restrictTo('ADMIN', 'LANDLORD'), getTicketImages);
maintenanceRouter.get('/images/:imageId', protect(), restrictTo('ADMIN', 'LANDLORD'), downloadTicketImage);

// Landlord routes
maintenanceRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyTickets);
maintenanceRouter.patch('/:id/approve', protect('landlord'), restrictTo('LANDLORD'), approveQuote);
maintenanceRouter.patch('/:id/decline', protect('landlord'), restrictTo('LANDLORD'), declineQuote);

// Admin routes
maintenanceRouter.get('/', protect('admin'), restrictTo('ADMIN'), getAllTickets);
maintenanceRouter.patch('/:id/status', protect('admin'), restrictTo('ADMIN'), updateTicketStatus);

// Contractor routes (admin)
maintenanceRouter.get('/contractors', protect('admin'), restrictTo('ADMIN'), getAllContractors);
maintenanceRouter.post('/contractors', protect('admin'), restrictTo('ADMIN'), createContractor);
maintenanceRouter.get('/contractors/:id', protect('admin'), restrictTo('ADMIN'), getContractorById);
maintenanceRouter.patch('/contractors/:id', protect('admin'), restrictTo('ADMIN'), updateContractor);
maintenanceRouter.delete('/contractors/:id', protect('admin'), restrictTo('ADMIN'), deleteContractor);

export default maintenanceRouter;
