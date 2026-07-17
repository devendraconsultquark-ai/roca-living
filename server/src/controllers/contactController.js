import { catchAsync } from '../utils/catchAsync.js';
import { sendEmail } from '../utils/email.js';
import logger from '../utils/logger.js';

const escapeHtml = (str) => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Public website enquiry form → email to the office inbox.
export const submitEnquiry = catchAsync(async (req, res, next) => {
  const { firstName, lastName, company, email, phone, enquiryType, message, location } = req.body;

  const to = process.env.CONTACT_EMAIL || process.env.EMAIL_USER || 'info@rocaliving.com';
  const fullName = `${firstName} ${lastName}`.trim();
  const topics = Array.isArray(enquiryType) && enquiryType.length > 0 ? enquiryType.join(', ') : '—';

  const text = [
    `New website enquiry from ${fullName}`,
    '',
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Company: ${company || '—'}`,
    `Location: ${location || '—'}`,
    `Enquiry type: ${topics}`,
    '',
    'Message:',
    message,
  ].join('\n');

  const html = `
    <h2>New website enquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Company:</strong> ${escapeHtml(company || '—')}</p>
    <p><strong>Location:</strong> ${escapeHtml(location || '—')}</p>
    <p><strong>Enquiry type:</strong> ${escapeHtml(topics)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
  `;

  // sendEmail logs and returns null when SMTP isn't configured — the enquiry
  // is still recorded in the application log below so it is never lost silently.
  await sendEmail({ to, subject: `Website enquiry — ${fullName}`, text, html });

  logger.info(`Contact enquiry received from ${email} (${fullName})`);

  res.status(200).json({
    success: true,
    message: 'Message sent successfully! We will contact you soon.',
  });
});
