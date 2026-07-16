import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Default landlord-scope compliance checklist — single source of truth shared
// with landlordSetup.js (kept inline here so the migration is self-contained
// and stable even if the runtime list evolves later).
const LANDLORD_CHECKLIST_ITEMS = [
  { item_code: 'KYC_PENDING', item_label: 'KYC Passed' },
  { item_code: 'TOB_SIGNED', item_label: 'Terms of Business Signed' },
  { item_code: 'OWNERSHIP_CONFIRMED', item_label: 'Ownership Confirmed' },
  { item_code: 'BANK_DETAILS_ADDED', item_label: 'Bank Details Added & Verified' }
];

export const runPhase13Migrations = async () => {
  logger.info('Starting Phase 13 database migrations (data consistency)...');

  // ── 1. transactions.ticket_id — replaces the fragile description-LIKE dedup
  //       for contractor_cost rows with a real reference.
  if (!(await db.schema.hasColumn('transactions', 'ticket_id'))) {
    await db.schema.alterTable('transactions', (table) => {
      table.integer('ticket_id').unsigned().nullable();
      table.index(['type', 'ticket_id'], 'idx_transactions_type_ticket');
    });
    logger.info("Added 'ticket_id' column to 'transactions'.");

    // Backfill from the legacy description format:
    //   "... maintenance ticket ID <n> (<title>)"
    const legacyRows = await db('transactions')
      .where('type', 'contractor_cost')
      .whereNull('ticket_id')
      .where('description', 'like', '%ticket ID %');
    for (const row of legacyRows) {
      const match = /ticket ID (\d+)/.exec(row.description || '');
      if (match) {
        await db('transactions').where('id', row.id).update({ ticket_id: parseInt(match[1], 10) });
      }
    }
    if (legacyRows.length > 0) {
      logger.info(`Backfilled ticket_id on ${legacyRows.length} contractor_cost transactions.`);
    }
  }

  // ── 2. Landlord accounts created via public signup lack a profile, reference
  //       and compliance checklist (admin-created ones have all three). Backfill
  //       so every LANDLORD user has the same data shape.
  const bareLandlords = await db('users')
    .leftJoin('landlord_profiles', 'users.id', 'landlord_profiles.user_id')
    .where('users.role', 'LANDLORD')
    .whereNull('landlord_profiles.id')
    .select('users.id');
  for (const { id } of bareLandlords) {
    await db('landlord_profiles').insert({
      user_id: id,
      landlord_reference: `REM-LND-${String(id).padStart(3, '0')}`
    });
  }
  if (bareLandlords.length > 0) {
    logger.info(`Created landlord_profiles for ${bareLandlords.length} bare landlord account(s).`);
  }

  // Profiles that exist but never got a reference (defensive — cheap to check).
  const noRef = await db('landlord_profiles').whereNull('landlord_reference').select('user_id');
  for (const { user_id } of noRef) {
    await db('landlord_profiles')
      .where({ user_id })
      .update({ landlord_reference: `REM-LND-${String(user_id).padStart(3, '0')}` });
  }

  // Landlord-scope checklists: insert any missing item for every landlord.
  const landlordIds = await db('users').where('role', 'LANDLORD').pluck('id');
  let checklistAdded = 0;
  for (const landlordId of landlordIds) {
    const existingCodes = await db('compliance_checklist')
      .where({ scope: 'landlord', entity_id: landlordId })
      .pluck('item_code');
    const missing = LANDLORD_CHECKLIST_ITEMS.filter((i) => !existingCodes.includes(i.item_code));
    if (missing.length > 0) {
      await db('compliance_checklist').insert(missing.map((item) => ({
        scope: 'landlord',
        entity_id: landlordId,
        item_code: item.item_code,
        item_label: item.item_label,
        applicable: 1,
        status: 'pending'
      })));
      checklistAdded += missing.length;
    }
  }
  if (checklistAdded > 0) {
    logger.info(`Backfilled ${checklistAdded} landlord compliance checklist item(s).`);
  }

  // ── 3. NRL consolidation — nrl_number duplicated nrl_hmrc_ref with no write
  //       path. Copy any values across, then drop the duplicate column.
  if (await db.schema.hasColumn('landlord_profiles', 'nrl_number')) {
    await db('landlord_profiles')
      .whereNotNull('nrl_number')
      .where((qb) => qb.whereNull('nrl_hmrc_ref').orWhere('nrl_hmrc_ref', ''))
      .update({ nrl_hmrc_ref: db.ref('nrl_number') });

    await db.schema.alterTable('landlord_profiles', (table) => {
      table.dropColumn('nrl_number');
    });
    logger.info("Merged 'nrl_number' into 'nrl_hmrc_ref' and dropped the duplicate column.");
  }

  logger.info('Phase 13 migrations completed successfully.');
};
