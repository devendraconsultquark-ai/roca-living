import bcrypt from "bcrypt";
import db from "../config/db.js";
import logger from "../utils/logger.js";
import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { catchAsync } from "../utils/catchAsync.js";
import { sendEmail } from "../utils/email.js";
import { getForgotPasswordEmail, getLoginAlertEmail, getPasswordResetSuccessEmail } from "../utils/emailTemplates.js";
import { eraseLandlordData } from "./landlordController.js";
import { ensureLandlordSetup } from "../utils/landlordSetup.js";

// bcrypt work factor — configurable via env so it can be tuned without code changes.
const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12', 10);


export const register = catchAsync(async (req, res, next) => {
    const { name, email, password, phone, address } = req.body;

    const userExists = await db("users").where({ email: email.toLowerCase() }).first();

    if (userExists) {
        throw new ApiError(409, "A user with this email address already exists");
    }

    // 1. Hash the password before saving to the database
    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

    // 2. Create the account with the same data shape as admin-created landlords:
    //    profile + landlord_reference + compliance checklist (all in one transaction).
    let newUserId;
    await db.transaction(async (trx) => {
        [newUserId] = await trx("users").insert({
            name: name,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone: phone,
            address: address,
            role: 'LANDLORD'
        });

        await ensureLandlordSetup(trx, newUserId);

        // 3. Audit the account creation, consistent with other user mutations
        await trx("audit_log").insert({
            actor_id: newUserId,
            actor_role: 'LANDLORD',
            action: 'USER_REGISTERED',
            entity_type: 'user',
            entity_id: newUserId,
            meta: JSON.stringify({ email: email.toLowerCase() }),
            ip_address: req.ip || null
        });
    });

    logger.info(`User registered: ${newUserId}`);

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
    const { email, password, portal } = req.body;

    const user = await db("users").where({ email: email.toLowerCase() }).first();

    if (!user) {
        throw new ApiError(401, "Invalid email or password");
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
        throw new ApiError(401, "Invalid email or password");
    }

    // Role check based on portal
    if (portal === 'admin' && user.role !== 'ADMIN') {
        throw new ApiError(403, "Access denied. Only administrators can sign in to the Admin Portal.");
    }

    if (portal === 'landlord' && user.role !== 'LANDLORD') {
        throw new ApiError(403, "Access denied. Only landlords can sign in to the Landlord Portal.");
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

    // Return the same full payload as GET /auth/me so the frontends don't
    // render blank profile fields until the next page reload.
    const payload = await getUserPayload(user.id, user.role);

    res.json({
        success: true,
        message: "Login successful",
        data: payload
    });
});

export const logout = catchAsync(async (req, res, next) => {
    const { portal } = req.body;

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0
    };

    if (portal === "admin") {
        res.cookie("jwt_admin", "", cookieOptions);
    } else if (portal === "landlord") {
        res.cookie("jwt_landlord", "", cookieOptions);
    } else {
        res.cookie("jwt_admin", "", cookieOptions);
        res.cookie("jwt_landlord", "", cookieOptions);
    }

    res.json({
        success: true,
        message: "Logged out successfully"
    });
});

const getUserPayload = async (userId, role) => {
    if (role === 'LANDLORD') {
        const data = await db("users")
            .leftJoin("landlord_profiles", "users.id", "landlord_profiles.user_id")
            .leftJoin("landlord_payment_details", "users.id", "landlord_payment_details.user_id")
            .select(
                "users.id", "users.name", "users.email", "users.phone", "users.role", "users.address", "users.created_at",
                "landlord_profiles.company_name",
                "landlord_profiles.landlord_reference",
                "landlord_profiles.initials",
                "landlord_profiles.is_overseas",
                "landlord_profiles.nrl_hmrc_approved",
                "landlord_profiles.nrl_hmrc_ref",
                "landlord_profiles.nrl_withhold_pct",
                "landlord_profiles.kyc_status",
                "landlord_profiles.kyc_provider",
                "landlord_profiles.kyc_ref",
                "landlord_profiles.sanctions_checked",
                "landlord_profiles.tob_status",
                "landlord_profiles.tob_signed_at",
                "landlord_profiles.ownership_confirmed",
                "landlord_profiles.ownership_share",
                "landlord_payment_details.bank_name",
                "landlord_payment_details.account_name",
                "landlord_payment_details.account_number",
                "landlord_payment_details.sort_code",
                "landlord_payment_details.iban_bic",
                "landlord_payment_details.verified_at",
                "landlord_payment_details.change_pending"
            )
            .where({ "users.id": userId })
            .first();

        if (data) {
            if (data.nrl_withhold_pct !== null && data.nrl_withhold_pct !== undefined) {
                data.nrl_withhold_pct = parseFloat(data.nrl_withhold_pct).toFixed(2);
            }
            if (data.ownership_share !== null && data.ownership_share !== undefined) {
                data.ownership_share = parseFloat(data.ownership_share).toFixed(2);
            }
        }
        return data;
    } else {
        return await db("users")
            .select("id", "name", "email", "phone", "role", "address", "created_at")
            .where({ id: userId })
            .first();
    }
};

export const getMe = catchAsync(async (req, res, next) => {
    const user = await getUserPayload(req.user.id, req.user.role);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    res.json({
        success: true,
        data: user
    });
});

export const updateProfile = catchAsync(async (req, res, next) => {
    const {
        name, email, phone, address,
        // landlord_profiles (tax / company)
        companyName, isOverseas, nrlHmrcApproved, nrlHmrcRef,
        // landlord_payment_details (bank / payout)
        bankName, accountName, accountNumber, sortCode, ibanBic,
    } = req.body;

    const user = await db("users").where({ id: req.user.id }).first();
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const isLandlord = user.role === 'LANDLORD';

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

    // Company / tax details, stored in landlord_profiles (landlords only).
    const profileUpdates = {};
    if (isLandlord) {
        if (companyName !== undefined) profileUpdates.company_name = companyName;
        if (isOverseas !== undefined) profileUpdates.is_overseas = isOverseas ? 1 : 0;
        if (nrlHmrcApproved !== undefined) profileUpdates.nrl_hmrc_approved = nrlHmrcApproved ? 1 : 0;
        if (nrlHmrcRef !== undefined) profileUpdates.nrl_hmrc_ref = nrlHmrcRef;
    }

    // Bank / payout details, stored in landlord_payment_details (landlords only).
    const paymentUpdates = {};
    if (isLandlord) {
        if (bankName !== undefined) paymentUpdates.bank_name = bankName;
        if (accountName !== undefined) paymentUpdates.account_name = accountName;
        if (accountNumber !== undefined) paymentUpdates.account_number = accountNumber;
        if (sortCode !== undefined) paymentUpdates.sort_code = sortCode;
        if (ibanBic !== undefined) paymentUpdates.iban_bic = ibanBic;
    }

    await db.transaction(async (trx) => {
        if (Object.keys(updates).length > 0) {
            await trx("users").where({ id: req.user.id }).update(updates);
        }

        if (Object.keys(profileUpdates).length > 0) {
            const existingProfile = await trx("landlord_profiles").where({ user_id: req.user.id }).first();
            if (existingProfile) {
                await trx("landlord_profiles").where({ user_id: req.user.id }).update(profileUpdates);
            } else {
                await trx("landlord_profiles").insert({ user_id: req.user.id, ...profileUpdates });
            }
        }

        let bankDetailsChanged = false;
        let changedPaymentFields = [];
        if (Object.keys(paymentUpdates).length > 0) {
            const existingPayment = await trx("landlord_payment_details").where({ user_id: req.user.id }).first();

            // Only treat fields whose value actually differs as changes, so saving an
            // unrelated profile edit doesn't re-flag already-verified bank details.
            const differs = (a, b) => String(a ?? '') !== String(b ?? '');
            const realChanges = {};
            for (const [field, value] of Object.entries(paymentUpdates)) {
                if (!existingPayment || differs(existingPayment[field], value)) {
                    realChanges[field] = value;
                }
            }

            // Don't create a payment row (or flag a pending change) when the form
            // submitted nothing but empty bank fields and none exist yet.
            const hasAnyValue = Object.values(realChanges).some(v => String(v ?? '').trim() !== '');
            if (Object.keys(realChanges).length > 0 && (existingPayment || hasAnyValue)) {
                bankDetailsChanged = true;
                changedPaymentFields = Object.keys(realChanges);
                // Any bank-detail change must be re-verified by an admin before payouts —
                // same rule as the admin flow (updatePaymentDetails/verifyPaymentDetails).
                const pendingFlags = { change_pending: 1, change_requested_at: trx.fn.now() };

                if (existingPayment) {
                    await trx("landlord_payment_details").where({ user_id: req.user.id }).update({ ...realChanges, ...pendingFlags });
                } else {
                    // Bank columns are NOT NULL, so fall back to '' for any field not supplied.
                    await trx("landlord_payment_details").insert({
                        user_id: req.user.id,
                        bank_name: realChanges.bank_name ?? '',
                        account_name: realChanges.account_name ?? '',
                        account_number: realChanges.account_number ?? '',
                        sort_code: realChanges.sort_code ?? '',
                        iban_bic: realChanges.iban_bic ?? null,
                        ...pendingFlags,
                    });
                }
            }
        }

        // Audit log. Record which fields changed but NOT sensitive bank values.
        const auditMeta = { ...updates };
        if (Object.keys(profileUpdates).length > 0) {
            auditMeta.profile_fields_changed = Object.keys(profileUpdates);
        }
        if (bankDetailsChanged) {
            auditMeta.payment_fields_changed = changedPaymentFields;
        }
        if (user.role === 'LANDLORD') {
            auditMeta.landlord_profile_changes = true;
        }
        await trx("audit_log").insert({
            actor_id: req.user.id,
            actor_role: req.user.role,
            action: 'USER_PROFILE_UPDATED',
            entity_type: 'user',
            entity_id: req.user.id,
            meta: JSON.stringify(auditMeta),
            ip_address: req.ip || null
        });

        // Separate audit event mirroring the admin flow, so bank-detail change
        // requests are searchable under one action regardless of who made them.
        if (bankDetailsChanged) {
            await trx("audit_log").insert({
                actor_id: req.user.id,
                actor_role: req.user.role,
                action: 'PAYMENT_DETAILS_CHANGE_REQUESTED',
                entity_type: 'landlord',
                entity_id: req.user.id,
                meta: JSON.stringify({ fields_changed: auditMeta.payment_fields_changed, self_service: true }),
                ip_address: req.ip || null
            });
        }
    });

    const updatedUser = await getUserPayload(req.user.id, req.user.role);

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

    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_COST);
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

  // Always return the same response regardless of whether the email exists or which
  // portal it belongs to, so this endpoint cannot be used to enumerate accounts or roles.
  const genericResponse = () => res.json({
    success: true,
    message: "If an account exists for that email, a password reset link has been sent."
  });

  const user = await db("users").where({ email: email.toLowerCase().trim() }).first();

  if (!user) return genericResponse();
  if (portal === 'admin' && user.role !== 'ADMIN') return genericResponse();
  if ((portal === 'client' || portal === 'landlord') && user.role !== 'LANDLORD') return genericResponse();

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

  await db("users").where({ id: user.id }).update({
    password_reset_token: hashedToken,
    password_reset_expires: expiresAt
  });

  const portalPath = '';
  
  // Smart origin detection: use req.headers.origin or extract from req.headers.referer, fallback to port defaults
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch (e) {
      // Ignore malformed referrer URLs
    }
  }
  if (!origin) {
    origin = portal === 'admin' ? 'http://localhost:5174' : 'http://localhost:5173';
  }

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

  // Do NOT log the reset link/token (it is a live credential). Log a non-secret event only.
  logger.info(`Password reset requested for user ${user.id}`);

  return genericResponse();
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

  const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

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

// GDPR Art. 15/20 — export the caller's personal data as a downloadable JSON file.
export const exportMyData = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const profile = await getUserPayload(userId, req.user.role);

  const [properties, statements, invoices, transactions, documents] = await Promise.all([
    db('properties').where('landlord_id', userId),
    db('landlord_statements').where('landlord_id', userId),
    db('invoices').where('landlord_id', userId),
    db('transactions').where('landlord_id', userId),
    db('documents').where({ owner_type: 'landlord', owner_id: userId })
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile,
    properties,
    statements,
    invoices,
    transactions,
    documents
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="my-roca-living-data.json"');
  res.status(200).send(JSON.stringify(payload, null, 2));
});

// GDPR Art. 17 — self-service erasure of the caller's own account and associated data.
export const deleteMyAccount = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'LANDLORD') {
    throw new ApiError(403, 'Only landlord accounts can be deleted through the portal. Please contact support.');
  }

  const user = await db('users').where({ id: req.user.id, role: 'LANDLORD' }).first();
  if (!user) {
    throw new ApiError(404, 'Account not found');
  }

  await db.transaction((trx) => eraseLandlordData(trx, req.user.id, { id: req.user.id, role: req.user.role, ip: req.ip }));

  res.cookie('jwt_landlord', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0
  });

  res.json({
    success: true,
    message: 'Your account and all associated data have been permanently deleted.'
  });
});

