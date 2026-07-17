// Shared setup for LANDLORD accounts. Every creation path (public signup,
// admin create, onboarding wizard) must produce the same data shape: a
// landlord_profiles row with a landlord_reference, plus the landlord-scope
// compliance checklist. Phase 13 migration backfills accounts created before
// this existed.

import { deriveInitials } from './initials.js';

export const LANDLORD_CHECKLIST_ITEMS = [
  { item_code: 'KYC_PENDING', item_label: 'KYC Passed' },
  { item_code: 'TOB_SIGNED', item_label: 'Terms of Business Signed' },
  { item_code: 'OWNERSHIP_CONFIRMED', item_label: 'Ownership Confirmed' },
  { item_code: 'BANK_DETAILS_ADDED', item_label: 'Bank Details Added & Verified' }
];

export const landlordReferenceFor = (userId) => `REM-LND-${String(userId).padStart(3, '0')}`;

/**
 * Idempotently ensure a landlord user has a profile (with reference) and the
 * default compliance checklist. `profileFields` are applied on top — inserted
 * with the new profile, or updated onto an existing one.
 *
 * Must be called inside the caller's transaction (`trx`).
 */
export const ensureLandlordSetup = async (trx, userId, profileFields = {}) => {
  const existingProfile = await trx('landlord_profiles').where({ user_id: userId }).first();

  // Statement initials always live in the DB: when none are supplied and the
  // profile has none, derive them from the user's name.
  if (!profileFields.initials && !existingProfile?.initials) {
    const user = await trx('users').where({ id: userId }).first('name');
    const derived = deriveInitials(user?.name);
    if (derived) profileFields = { ...profileFields, initials: derived };
  }

  if (existingProfile) {
    const updates = { ...profileFields };
    if (!existingProfile.landlord_reference) {
      updates.landlord_reference = landlordReferenceFor(userId);
    }
    if (Object.keys(updates).length > 0) {
      await trx('landlord_profiles').where({ user_id: userId }).update(updates);
    }
  } else {
    await trx('landlord_profiles').insert({
      user_id: userId,
      landlord_reference: landlordReferenceFor(userId),
      ...profileFields
    });
  }

  const existingCodes = await trx('compliance_checklist')
    .where({ scope: 'landlord', entity_id: userId })
    .pluck('item_code');
  const missing = LANDLORD_CHECKLIST_ITEMS.filter((i) => !existingCodes.includes(i.item_code));
  if (missing.length > 0) {
    await trx('compliance_checklist').insert(missing.map((item) => ({
      scope: 'landlord',
      entity_id: userId,
      item_code: item.item_code,
      item_label: item.item_label,
      applicable: 1,
      status: 'pending'
    })));
  }
};
