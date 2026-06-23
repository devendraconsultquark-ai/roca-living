import bcrypt from "bcrypt";
import db from "../config/db.js";
import logger from "../utils/logger.js";
import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { catchAsync } from "../utils/catchAsync.js";
import { sendEmail } from "../utils/email.js";
import { getForgotPasswordEmail, getLoginAlertEmail, getPasswordResetSuccessEmail } from "../utils/emailTemplates.js";


export const register = catchAsync(async (req, res, next) => {
    const { name, email, password, phone, address } = req.body;

    const userExists = await db("users").where({ email: email.toLowerCase() }).first();

    if (userExists) {
        throw new ApiError(409, "A user with this email address already exists");
    }

    // 1. Hash the password before saving to the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Insert with the hashed password
    const [newUserId] = await db("users").insert({
        name: name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone,
        address: address
    });

    logger.info("User Created successfully");

    // 3. Send structured success response
    res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
            id: newUserId,
            name: name,
            email: email.toLowerCase()
        }
    });
});

export const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    const user = await db("users").where({ email: email.toLowerCase() }).first();

    if (!user) {
        throw new ApiError(401, "Invalid email or password");
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
        throw new ApiError(401, "Invalid email or password");
    }

    const token = jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    const cookieName = user.role === "ADMIN" ? "jwt_admin" : "jwt_landlord";

    res.cookie(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logger.info(`User login successful: ${user.id}`);

    // Send successful login notification email
    try {
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const time = new Date().toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC';
      const userAgent = req.headers['user-agent'] || 'Unknown Browser/Device';
      
      const html = getLoginAlertEmail(user.name, { ipAddress, time, userAgent });
      const text = `Hello ${user.name},\n\nWe detected a successful login to your Roca Living account on ${time} from IP Address: ${ipAddress} (Device: ${userAgent}).\n\nIf this was not you, please secure your account immediately.\n`;

      // Dispatch email asynchronously so it doesn't block the login process
      sendEmail({
        to: user.email,
        subject: "Roca Living - New Sign-in Detected",
        text,
        html
      }).catch(err => logger.error(`Failed to send login alert email: ${err.message}`));
    } catch (emailErr) {
      logger.error(`Error building login alert email: ${emailErr.message}`);
    }

    res.json({
        success: true,
        message: "Login successful",
        data: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
});

export const logout = catchAsync(async (req, res, next) => {
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0
    };

    res.cookie("jwt_admin", "", cookieOptions);
    res.cookie("jwt_landlord", "", cookieOptions);

    res.json({
        success: true,
        message: "Logged out successfully"
    });
});

export const getMe = catchAsync(async (req, res, next) => {
    const user = await db("users")
        .select("id", "name", "email", "phone", "role", "address", "created_at")
        .where({ id: req.user.id })
        .first();

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    res.json({
        success: true,
        data: user
    });
});

export const updateProfile = catchAsync(async (req, res, next) => {
    const { name, email, phone, address } = req.body;

    const user = await db("users").where({ id: req.user.id }).first();
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) {
        const lowercaseEmail = email.toLowerCase().trim();
        if (lowercaseEmail !== user.email) {
            const emailExists = await db("users").where({ email: lowercaseEmail }).first();
            if (emailExists) {
                throw new ApiError(409, "Email is already in use");
            }
            updates.email = lowercaseEmail;
        }
    }
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;

    if (Object.keys(updates).length > 0) {
        await db("users").where({ id: req.user.id }).update(updates);
        
        // Audit log
        await db("audit_log").insert({
            actor_id: req.user.id,
            actor_role: req.user.role,
            action: 'USER_PROFILE_UPDATED',
            entity_type: 'user',
            entity_id: req.user.id,
            meta: JSON.stringify(updates),
            ip_address: req.ip || null
        });
    }

    const updatedUser = await db("users")
        .select("id", "name", "email", "phone", "role", "address", "created_at")
        .where({ id: req.user.id })
        .first();

    res.json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser
    });
});

export const changePassword = catchAsync(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        throw new ApiError(400, "Current password and new password are required");
    }

    const user = await db("users").where({ id: req.user.id }).first();
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordMatch) {
        throw new ApiError(400, "Incorrect current password");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db("users").where({ id: req.user.id }).update({ password: hashedNewPassword });

    await db("audit_log").insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'USER_PASSWORD_CHANGED',
        entity_type: 'user',
        entity_id: req.user.id,
        meta: JSON.stringify({ action: "PASSWORD_CHANGED" }),
        ip_address: req.ip || null
    });

    res.json({
        success: true,
        message: "Password changed successfully"
    });
});

export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email, portal } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await db("users").where({ email: email.toLowerCase().trim() }).first();

  if (!user) {
    throw new ApiError(404, "User not found with this email");
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

  await db("users").where({ id: user.id }).update({
    password_reset_token: hashedToken,
    password_reset_expires: expiresAt
  });

  const portalPath = portal === 'admin' ? '/roca-living-2/admin' : '/roca-living-2/client';
  const origin = req.headers.origin || 'http://localhost:5173';
  const resetUrl = `${origin}${portalPath}/reset-password?token=${rawToken}`;

  // Send the actual email to the user using the template
  const subject = "Roca Living - Password Reset Request";
  const text = `Hello ${user.name},\n\nYou requested a password reset for your account on Roca Living.\nPlease click the link below or copy and paste it into your browser to reset your password:\n\n${resetUrl}\n\nThis link is valid for 1 hour.\n\nIf you did not request this, please ignore this email.\n`;
  const html = getForgotPasswordEmail(user.name, resetUrl);

  try {
    await sendEmail({ to: user.email, subject, text, html });
  } catch (mailErr) {
    logger.error(`Could not send password reset email to ${user.email}: ${mailErr.message}`);
  }

  logger.info(`[MOCK EMAIL] Password reset requested for ${user.email}. Link: ${resetUrl}`);
  
  if (process.env.NODE_ENV !== 'production') {
    try {
      const fs = await import('fs');
      fs.writeFileSync('scratch/last_reset_link.txt', resetUrl);
    } catch (fsErr) {
      logger.error(`Failed to write reset link to file: ${fsErr.message}`);
    }
  }

  res.json({
    success: true,
    message: "Reset link sent successfully to your email."
  });
});

export const resetPassword = catchAsync(async (req, res, next) => {
  const { token, password } = req.body;

  if (!token || !password) {
    throw new ApiError(400, "Token and new password are required");
  }

  // Password strength validation: min 8 char, 1 uppercase, 1 lowercase, 1 special char
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new ApiError(400, "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character");
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await db("users")
    .where('password_reset_token', hashedToken)
    .andWhere('password_reset_expires', '>', new Date())
    .first();

  if (!user) {
    throw new ApiError(400, "Password reset token is invalid or has expired");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db("users").where({ id: user.id }).update({
    password: hashedPassword,
    password_reset_token: null,
    password_reset_expires: null
  });

  await db("audit_log").insert({
    actor_id: user.id,
    actor_role: user.role,
    action: 'USER_PASSWORD_RESET',
    entity_type: 'user',
    entity_id: user.id,
    meta: JSON.stringify({ action: "PASSWORD_RESET_SUCCESS" }),
    ip_address: req.ip || null
  });

  // Send password reset success confirmation email
  try {
    const html = getPasswordResetSuccessEmail(user.name);
    const text = `Hello ${user.name},\n\nThis is a confirmation that the password for your Roca Living account was changed successfully.\n\nIf you did not make this change, please contact support immediately.\n`;

    // Dispatch email asynchronously
    sendEmail({
      to: user.email,
      subject: "Roca Living - Password Reset Confirmed",
      text,
      html
    }).catch(err => logger.error(`Failed to send password reset confirmation email: ${err.message}`));
  } catch (emailErr) {
    logger.error(`Error building password reset confirmation email: ${emailErr.message}`);
  }

  res.json({
    success: true,
    message: "Password has been reset successfully"
  });
});

