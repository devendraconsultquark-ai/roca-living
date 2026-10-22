import nodemailer from "nodemailer";
import logger from "./logger.js";

// Create a transporter using SMTP settings from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.mailtrap.io",
  port: parseInt(process.env.EMAIL_PORT || "2525"),
  auth: {
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
  },
});

// ─── Email kill switch (developer setting, .env only) ───────────────────────
// Emails go out only when EMAIL_ENABLED=true. Otherwise (development, or the
// flag unset) they are logged and skipped, and the caller gets a result shaped
// like a real send, so flows such as "Send statement" still complete without
// emailing a real landlord. Live must set EMAIL_ENABLED=true.
// Exception: `essential` emails (password reset link, new-login alert) always
// send; they only ever go to the person who is signing in or resetting.
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === "true";
if (!EMAIL_ENABLED) {
  logger.warn("EMAIL SENDING IS DISABLED (EMAIL_ENABLED is not 'true'): only password reset links and login alerts are sent.");
}

/**
 * Send an email using configured transporter
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject line
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML rich text content
 * @param {Array}  [options.attachments] - nodemailer attachments, e.g. [{ filename, content }]
 * @param {boolean} [options.essential] - send even when EMAIL_ENABLED is off (reset links, login alerts)
 * @returns the send info, or null when SMTP is not configured (nothing sent)
 */
export const sendEmail = async ({ to, cc, subject, text, html, attachments, essential = false }) => {
  if (!EMAIL_ENABLED && !essential) {
    logger.warn(`[EMAIL DISABLED] Suppressed email to ${to}${cc ? ` (cc ${cc})` : ''}. Subject: ${subject}`);
    return { messageId: "suppressed", accepted: [], rejected: [], response: "Email suppressed: EMAIL_ENABLED is not 'true'" };
  }

  // If SMTP user/password is not configured, warn and skip sending (fallback to logging)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn(`[SMTP NOT CONFIGURED] Skipping actual email to ${to}. Subject: ${subject}`);
    return null;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Roca Living" <noreply@rocaliving.com>',
    to,
    ...(cc ? { cc } : {}),
    subject,
    text,
    html,
    ...(attachments ? { attachments } : {}),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Error sending email to ${to}: ${error.message}`);
    throw error;
  }
};
