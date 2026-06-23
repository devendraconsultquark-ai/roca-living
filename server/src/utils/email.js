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

/**
 * Send an email using configured transporter
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject line
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML rich text content
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  // If SMTP user/password is not configured, warn and skip sending (fallback to logging)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn(`[SMTP NOT CONFIGURED] Skipping actual email to ${to}. Subject: ${subject}`);
    return null;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Roca Living" <noreply@rocaliving.com>',
    to,
    subject,
    text,
    html,
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
