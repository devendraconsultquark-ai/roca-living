import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 28 — Xero organisation choice: when the person who authorises Xero can
// see several organisations, the admin picks the right one instead of Roca
// Living silently taking the first.
export const runPhase28Migrations = async () => {
  logger.info('Starting Phase 28 database migrations...');

  if (!(await db.schema.hasColumn('xero_connections', 'needs_org_choice'))) {
    await db.schema.alterTable('xero_connections', (table) => {
      table.boolean('needs_org_choice').notNullable().defaultTo(false);
    });
    logger.info("Added 'needs_org_choice' to 'xero_connections'.");
  }

  logger.info('Phase 28 database migrations completed successfully.');
};
