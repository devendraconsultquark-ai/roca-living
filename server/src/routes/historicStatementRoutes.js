import { Router } from 'express';
import { listHistoricStatements, listMyHistoricStatements, downloadHistoricStatement } from '../controllers/historicStatementController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

// Historic statements (before Roca Living) — read-only.
const historicStatementRouter = Router();
historicStatementRouter.get('/my', protect('landlord'), restrictTo('LANDLORD'), listMyHistoricStatements);
historicStatementRouter.get('/', protect('admin'), restrictTo('ADMIN'), listHistoricStatements);
historicStatementRouter.get('/:id/pdf', protect(), restrictTo('ADMIN', 'LANDLORD'), downloadHistoricStatement);

export default historicStatementRouter;
