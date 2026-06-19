import { Router } from "express";
import { register, login } from "../controllers/authController.js";
import { registerSchema, loginSchema } from "../validations/authValidation.js";
import { validate } from "../middlewares/validate.js";
const authRouter = Router();

authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", validate(loginSchema), login);

export default authRouter;
