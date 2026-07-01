import { Router } from 'express';
import {
  createTicket,
  updateTicketStatus,
  getAllTickets,
  getMyTickets,
  approveQuote,
  getAllContractors,
  createContractor,
  updateContractor,
  deleteContractor,
  getContractorById
} from '../controllers/maintenanceController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const maintenanceRouter = Router();

// General routes (accessible by both Admin and Landlord)
maintenanceRouter.post('/', protect(), restrictTo('ADMIN', 'LANDLORD'), createTicket);

// Landlord routes
maintenanceRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getMyTickets);
maintenanceRouter.patch('/:id/approve', protect('landlord'), restrictTo('LANDLORD'), approveQuote);

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
