import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 38 — statements from approved rent (Rent Cycle, AR-…) can be emailed to
// the landlord like the usual statements: an email draft the admin checks, then
// sent with the PDF (same columns as landlord_statements).
export const runPhase38Migrations = async () => {
  logger.info('Starting Phase 38 database migrations...');
  if (!(await db.schema.hasColumn('approved_rent_statements', 'email_subject'))) {
    await db.schema.alterTable('approved_rent_statements', (t) => {
      t.string('email_to', 500).nullable();
      t.string('email_cc', 500).nullable();
      t.string('email_subject', 255).nullable();
      t.text('email_body').nullable();
      t.timestamp('sent_at').nullable();
      t.string('sent_to', 255).nullable();
    });
    logger.info("Added the email draft and 'sent_at' / 'sent_to' to 'approved_rent_statements'.");
  }
  logger.info('Phase 38 database migrations completed successfully.');
};
