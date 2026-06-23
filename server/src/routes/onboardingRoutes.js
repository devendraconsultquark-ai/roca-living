import { Router } from 'express';
import { completeOnboarding } from '../controllers/onboardingController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const onboardingRouter = Router();

onboardingRouter.post('/', protect('admin'), restrictTo('ADMIN'), completeOnboarding);

export default onboardingRouter;
