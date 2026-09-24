import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 18 — tenant-based statements: a statement is generated for a tenancy
// and rent period (Statements page → select tenant → autofill → generate), and
// is linked to the fee invoice generated with it.
export const runPhase18Migrations = async () => {
  logger.info('Starting Phase 18 database migrations...');

  if (!(await db.schema.hasColumn('landlord_statements', 'tenancy_id'))) {
    await db.schema.alterTable('landlord_statements', (table) => {
      table.integer('tenancy_id').unsigned().nullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies').onDelete('SET NULL');
      table.integer('invoice_id').unsigned().nullable();
      table.foreign('invoice_id').references('id').inTable('invoices').onDelete('SET NULL');
      table.decimal('total_income', 10, 2).nullable();
      table.decimal('total_expenditure', 10, 2).nullable();
      // previous_balance + income − expenditure; a negative balance carries to the next statement
      table.decimal('closing_balance', 10, 2).nullable();
      table.index(['tenancy_id', 'period_start'], 'idx_statements_tenancy_period');
    });
    logger.info("Added tenancy/invoice link and totals to 'landlord_statements'.");
  }

  // ROCA's management fee is 8%. Only move the default if it is still the
  // original seed value, so a fee an admin has since set in Settings is kept.
  const agencyFee = await db('settings').where({ key: 'agencyFee' }).first();
  if (agencyFee && ['12', '12.0', '12.00'].includes(String(agencyFee.value).trim())) {
    await db('settings').where({ key: 'agencyFee' }).update({ value: '8.0', updated_at: db.fn.now() });
    logger.info("Default management fee (settings.agencyFee) moved from 12% to 8%.");
  }

  logger.info('Phase 18 database migrations completed successfully.');
};
