import { Router } from 'express';
import {
  getAllAgents,
  createAgent,
  updateAgent,
  createInstruction,
  addViewing,
  getInstructionViewings,
  deleteAgent
} from '../controllers/agentController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const agentRouter = Router();

// Apply auth middleware to all agent routes
agentRouter.use(protect('admin'), restrictTo('ADMIN'));

agentRouter.get('/', getAllAgents);
agentRouter.post('/', createAgent);
agentRouter.patch('/:id', updateAgent);
agentRouter.delete('/:id', deleteAgent);
agentRouter.post('/:id/instructions', createInstruction);
agentRouter.post('/instructions/:id/viewings', addViewing);
agentRouter.get('/instructions/:id/viewings', getInstructionViewings);

export default agentRouter;
