// One-time activation links for landlord accounts, shared with the landlord by
// the admin directly (WhatsApp / SMS / in person) — no email is sent. Reuses
// the password-reset token columns, so the existing /auth/reset-password
// endpoint and landlord-portal /reset-password page consume these links
// unchanged. Generating a new link invalidates any previous one.
import crypto from 'crypto';

const ACTIVATION_LINK_VALIDITY_DAYS = 7;

export const createActivationLink = async (trx, userId) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + ACTIVATION_LINK_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  await trx('users').where({ id: userId }).update({
    password_reset_token: hashedToken,
    password_reset_expires: expiresAt
  });

  const portalUrl = (process.env.LANDLORD_PORTAL_URL || 'http://localhost:5173').replace(/\/+$/, '');

  return {
    activation_link: `${portalUrl}/reset-password?token=${rawToken}`,
    activation_expires_at: expiresAt.toISOString()
  };
};
