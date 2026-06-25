import { Router } from "express";
import { register, login, logout, getMe, updateProfile, changePassword, forgotPassword, resetPassword } from "../controllers/authController.js";
import { registerSchema, loginSchema, changePasswordSchema } from "../validations/authValidation.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";

const authRouter = Router();

authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.get("/me", protect(), getMe);
authRouter.patch("/profile", protect(), updateProfile);
authRouter.patch("/change-password", protect(), validate(changePasswordSchema), changePassword);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);

export default authRouter;
