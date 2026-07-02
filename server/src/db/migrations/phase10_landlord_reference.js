import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase10Migrations = async () => {
  logger.info('Starting Phase 10 database migrations (landlord unique reference)...');

  // 1. Check if column exists, add it if not
  if (!(await db.schema.hasColumn('landlord_profiles', 'landlord_reference'))) {
    await db.schema.alterTable('landlord_profiles', (table) => {
      table.string('landlord_reference', 50).unique().nullable();
    });
    logger.info("Added 'landlord_reference' column to 'landlord_profiles' table.");

    // 2. Populate references for existing landlords
    const profiles = await db('landlord_profiles').select('id', 'user_id');
    for (const profile of profiles) {
      // Use user_id for sequence matching existing UI format
      const ref = `REM-LND-${String(profile.user_id).padStart(3, '0')}`;
      await db('landlord_profiles')
        .where({ id: profile.id })
        .update({ landlord_reference: ref });
    }
    logger.info("Populated 'landlord_reference' for existing landlord profiles.");

    // 3. Make column NOT NULL since it's required for all landlords
    await db.schema.alterTable('landlord_profiles', (table) => {
      table.string('landlord_reference', 50).notNullable().alter();
    });
    logger.info("Altered 'landlord_reference' column to NOT NULL.");
  }

  logger.info('Phase 10 migrations completed successfully.');
};
