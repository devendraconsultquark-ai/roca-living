import { Router } from 'express';
import {
  generateStatements,
  getStatements,
  getStatementById,
  getLandlordStatements,
  downloadStatement,
  getAutofillMetadata
} from '../controllers/statementController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const statementRouter = Router();

// Landlord Route - MUST be defined before /:id to prevent routing clash
statementRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), getLandlordStatements);

// Admin Routes
statementRouter.get('/autofill-metadata', protect('admin'), restrictTo('ADMIN'), getAutofillMetadata);
statementRouter.post('/generate', protect('admin'), restrictTo('ADMIN'), generateStatements);
statementRouter.get('/', protect('admin'), restrictTo('ADMIN'), getStatements);

// Shared Admin/Landlord routes (Ownership validated in controller)
statementRouter.get('/:id', protect(), restrictTo('ADMIN', 'LANDLORD'), getStatementById);
statementRouter.get('/:id/pdf', protect(), restrictTo('ADMIN', 'LANDLORD'), downloadStatement);

export default statementRouter;
