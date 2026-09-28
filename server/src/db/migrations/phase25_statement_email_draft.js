import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 25 — statement email draft (handover RL-006): the email that goes with
// a statement is prepared as a draft, reviewed/edited by the admin, then sent.
export const runPhase25Migrations = async () => {
  logger.info('Starting Phase 25 database migrations...');

  if (!(await db.schema.hasColumn('landlord_statements', 'email_subject'))) {
    await db.schema.alterTable('landlord_statements', (table) => {
      table.string('email_to', 500).nullable();
      table.string('email_cc', 500).nullable();
      table.string('email_subject', 255).nullable();
      table.text('email_body').nullable();
    });
    logger.info("Added email draft columns to 'landlord_statements'.");
  }

  logger.info('Phase 25 database migrations completed successfully.');
};
