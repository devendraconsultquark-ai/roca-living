import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 32 — deductions on approved rent (Rent Cycle): before approving, the
// admin can take costs ROCA paid for the flat (cleaning, repairs…) out of the
// landlord's share. They become minus lines on the Xero landlord bill and lines
// on the statement from approved rent. Net = rent − fee − deductions.
export const runPhase32Migrations = async () => {
  logger.info('Starting Phase 32 database migrations...');

  if (!(await db.schema.hasTable('rent_payment_deductions'))) {
    await db.schema.createTable('rent_payment_deductions', (table) => {
      table.increments('id').primary();
      table.integer('rent_payment_id').unsigned().notNullable();
      table.foreign('rent_payment_id').references('id').inTable('rent_payments').onDelete('CASCADE');
      table.string('description', 255).notNullable();
      table.string('supplier', 255).nullable();
      table.decimal('amount', 10, 2).notNullable();
      table.integer('created_by').unsigned().nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.index(['rent_payment_id'], 'idx_rent_payment_deductions_payment');
    });
    logger.info("Created 'rent_payment_deductions' table.");
  }

  if (!(await db.schema.hasColumn('rent_payments', 'deductions_amount'))) {
    await db.schema.alterTable('rent_payments', (t) => t.decimal('deductions_amount', 10, 2).notNullable().defaultTo(0));
    logger.info("Added 'deductions_amount' to 'rent_payments'.");
  }

  if (!(await db.schema.hasColumn('approved_rent_statements', 'total_deductions'))) {
    await db.schema.alterTable('approved_rent_statements', (t) => t.decimal('total_deductions', 10, 2).notNullable().defaultTo(0));
    logger.info("Added 'total_deductions' to 'approved_rent_statements'.");
  }

  logger.info('Phase 32 database migrations completed successfully.');
};
