import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 27 — rent due day (client request 7 Oct, Apt 8): rent can fall due on a
// different day of the month than the tenancy start day, with a pro-rata first
// payment. NULL = the start day (unchanged for every existing tenancy).
export const runPhase27Migrations = async () => {
  logger.info('Starting Phase 27 database migrations...');

  if (!(await db.schema.hasColumn('tenancies', 'rent_due_day'))) {
    await db.schema.alterTable('tenancies', (table) => {
      table.tinyint('rent_due_day').unsigned().nullable();
    });
    logger.info("Added 'rent_due_day' to 'tenancies'.");
  }

  logger.info('Phase 27 database migrations completed successfully.');
};
