import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 15 — Landlord detail page spec fields: internal notes, assigned account
// manager, and last-login stamping for the "last login" header line.
export const runPhase15Migrations = async () => {
  logger.info('Starting Phase 15 database migrations...');

  if (!(await db.schema.hasColumn('landlord_profiles', 'notes'))) {
    await db.schema.alterTable('landlord_profiles', (table) => {
      table.text('notes').nullable();
      table.integer('account_manager_id').unsigned().nullable();
      table.foreign('account_manager_id').references('id').inTable('users');
    });
    logger.info("Columns 'notes' and 'account_manager_id' added to 'landlord_profiles'.");
  }

  if (!(await db.schema.hasColumn('users', 'last_login_at'))) {
    await db.schema.alterTable('users', (table) => {
      table.datetime('last_login_at').nullable();
    });
    logger.info("Column 'last_login_at' added to 'users'.");
  }

  logger.info('Phase 15 database migrations run completed successfully!');
};
