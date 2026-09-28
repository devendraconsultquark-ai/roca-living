import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 24 — RL-P03 checks:
//   landlord_statements.render_data  the data the PDF was drawn from, so it can
//                                    be redrawn when the payout is confirmed
//   landlord_statements.pdf_paid     whether the stored PDF says "Transferred"
//                                    (only after the payout is confirmed, check 7)
//   property_expenses.invoice_path / invoice_name   the supplier invoice
//                                    behind a deduction (check 4)
export const runPhase24Migrations = async () => {
  logger.info('Starting Phase 24 database migrations...');

  if (!(await db.schema.hasColumn('landlord_statements', 'render_data'))) {
    await db.schema.alterTable('landlord_statements', (table) => {
      table.text('render_data', 'longtext').nullable();
      table.boolean('pdf_paid').notNullable().defaultTo(false);
    });
    logger.info("Added 'render_data' and 'pdf_paid' to 'landlord_statements'.");
  }

  if (!(await db.schema.hasColumn('property_expenses', 'invoice_path'))) {
    await db.schema.alterTable('property_expenses', (table) => {
      table.string('invoice_path', 500).nullable();
      table.string('invoice_name', 255).nullable();
    });
    logger.info("Added 'invoice_path' and 'invoice_name' to 'property_expenses'.");
  }

  logger.info('Phase 24 database migrations completed successfully.');
};
