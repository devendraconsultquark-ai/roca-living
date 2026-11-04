import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 41 — historic statements: the ROCA statements made outside Roca Living
// before it took over (June – November 2026), re-made in Roca Living's design
// with the figures as the bank shows them. Read-only for admin and landlord;
// never part of Generate Statement, its numbering, arrears or approvals.
export const runPhase41Migrations = async () => {
  logger.info('Starting Phase 41 database migrations...');
  if (!(await db.schema.hasTable('historic_statements'))) {
    await db.schema.createTable('historic_statements', (t) => {
      t.increments('id').primary();
      t.integer('property_id').unsigned().notNullable();
      t.integer('tenancy_id').unsigned().nullable();
      t.integer('landlord_id').unsigned().nullable(); // Roca Living landlord account
      t.string('flat', 20).notNullable();
      t.string('statement_number', 50).notNullable();
      t.string('invoice_number', 50).nullable();
      t.string('landlord_name', 255).nullable();
      t.string('tenant_name', 255).nullable();
      t.date('period_start').notNullable();
      t.date('period_end').notNullable();
      t.date('issued_on').nullable();
      t.json('income_lines').notNullable(); // [{ description, amount }]
      t.json('expenditure_lines').notNullable(); // [{ description, amount }]
      t.json('invoice_lines').nullable(); // [{ description, cost, discount }]
      t.text('invoice_notes').nullable();
      t.date('tenancy_start').nullable(); // as on the tenancy agreement
      t.decimal('total_income', 10, 2).notNullable();
      t.decimal('total_expenditure', 10, 2).notNullable();
      t.decimal('net_paid', 10, 2).notNullable();
      t.date('paid_on').nullable(); // the bank payout date
      t.string('source_file', 500).nullable(); // the client's original in Dropbox
      t.integer('document_id').unsigned().nullable(); // re-made PDF
      t.integer('original_document_id').unsigned().nullable(); // the original PDF, if imported
      t.string('xero_invoice_id', 64).nullable();
      t.string('xero_invoice_number', 50).nullable();
      t.string('xero_bill_id', 64).nullable();
      t.string('xero_bill_number', 50).nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.unique(['statement_number'], { indexName: 'uq_historic_statement_number' });
      t.index(['landlord_id'], 'idx_historic_statements_landlord');
      t.index(['property_id'], 'idx_historic_statements_property');
    });
    logger.info("Created 'historic_statements' table.");
  }
  // Columns added after the first version of this table.
  const added = { invoice_notes: (t) => t.text('invoice_notes').nullable(), tenancy_start: (t) => t.date('tenancy_start').nullable() };
  for (const [col, add] of Object.entries(added)) {
    if (!(await db.schema.hasColumn('historic_statements', col))) {
      await db.schema.alterTable('historic_statements', add);
      logger.info(`Added '${col}' to 'historic_statements'.`);
    }
  }
  logger.info('Phase 41 database migrations completed successfully.');
};
