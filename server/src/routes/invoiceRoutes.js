import { Router } from 'express';
import {
  generateInvoice,
  getInvoices,
  getInvoiceById,
  downloadInvoicePdf,
  updateInvoiceStatus
} from '../controllers/invoiceController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const invoiceRouter = Router();

// Routes
invoiceRouter.post('/generate', protect('admin'), restrictTo('ADMIN'), generateInvoice);
invoiceRouter.patch('/:id/status', protect('admin'), restrictTo('ADMIN'), updateInvoiceStatus);
invoiceRouter.get('/', protect(), restrictTo('ADMIN', 'LANDLORD'), getInvoices);
invoiceRouter.get('/:id', protect(), restrictTo('ADMIN', 'LANDLORD'), getInvoiceById);
invoiceRouter.get('/:id/pdf', protect(), restrictTo('ADMIN', 'LANDLORD'), downloadInvoicePdf);

export default invoiceRouter;
