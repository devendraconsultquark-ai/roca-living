import { Router } from 'express';
import {
  listCandidates,
  previewApprovedStatement,
  createApprovedStatement,
  listApprovedStatements,
  downloadApprovedStatement,
  deleteApprovedStatement
} from '../controllers/approvedRentStatementController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

// "Statement from approved rent" — the separate flow next to the existing
// statements (/statements is unchanged).
const approvedRentStatementRouter = Router();
approvedRentStatementRouter.use(protect('admin'), restrictTo('ADMIN'));

approvedRentStatementRouter.get('/candidates', listCandidates);
approvedRentStatementRouter.post('/preview', previewApprovedStatement);
approvedRentStatementRouter.get('/', listApprovedStatements);
approvedRentStatementRouter.post('/', createApprovedStatement);
approvedRentStatementRouter.get('/:id/pdf', downloadApprovedStatement);
approvedRentStatementRouter.delete('/:id', deleteApprovedStatement);

export default approvedRentStatementRouter;
