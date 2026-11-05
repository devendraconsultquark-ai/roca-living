import { Router } from 'express';
import { listAllStatements, listMyAllStatements, downloadAnyStatement } from '../controllers/allStatementsController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

// Every statement in one list (single source of truth for statements and money).
const allStatementsRouter = Router();
allStatementsRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), listMyAllStatements);
allStatementsRouter.get('/', protect('admin'), restrictTo('ADMIN'), listAllStatements);
allStatementsRouter.get('/:key/pdf', protect(), restrictTo('ADMIN', 'LANDLORD'), downloadAnyStatement);

export default allStatementsRouter;
