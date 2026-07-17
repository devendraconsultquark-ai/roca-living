import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { submitEnquiry } from '../controllers/contactController.js';
import { validate } from '../middlewares/validate.js';
import { contactSchema } from '../validations/contactValidation.js';

const contactRouter = Router();

// Public endpoint — throttle hard so the form can't be used as a mail cannon.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many enquiries, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

contactRouter.post('/', contactLimiter, validate(contactSchema), submitEnquiry);

export default contactRouter;
