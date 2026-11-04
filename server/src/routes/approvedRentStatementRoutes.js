import { Router } from 'express';
import {
  listCandidates,
  previewApprovedStatement,
  createApprovedStatement,
  listApprovedStatements,
  downloadApprovedStatement,
  deleteApprovedStatement,
  getApprovedStatementEmail,
  saveApprovedStatementEmail,
  sendApprovedStatement
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
approvedRentStatementRouter.get('/:id/email', getApprovedStatementEmail);
approvedRentStatementRouter.put('/:id/email', saveApprovedStatementEmail);
approvedRentStatementRouter.post('/:id/send', sendApprovedStatement);

export default approvedRentStatementRouter;
