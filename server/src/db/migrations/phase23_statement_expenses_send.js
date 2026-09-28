import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 23 — statements v2:
//   property_expenses        costs recorded against a managed apartment during
//                            the month (e.g. cleaning £6), deducted on the
//                            statement for that month and then marked used
//   landlord_statements.sent_at / sent_to   when/where the statement was emailed
export const runPhase23Migrations = async () => {
  logger.info('Starting Phase 23 database migrations...');

  if (!(await db.schema.hasTable('property_expenses'))) {
    await db.schema.createTable('property_expenses', (table) => {
      table.increments('id').primary();
      table.integer('property_id').unsigned().notNullable();
      table.foreign('property_id').references('id').inTable('properties').onDelete('CASCADE');
      table.date('expense_date').notNullable();
      table.string('description', 255).notNullable();
      table.string('supplier', 255).nullable();
      table.decimal('amount', 10, 2).notNullable();
      // Set when the expense is deducted on a statement (then it can't be used again).
      table.integer('statement_id').unsigned().nullable();
      table.foreign('statement_id').references('id').inTable('landlord_statements').onDelete('SET NULL');
      table.integer('created_by').unsigned().nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.index(['property_id', 'expense_date'], 'idx_property_expenses_date');
    });
    logger.info("Created 'property_expenses' table.");
  }

  if (!(await db.schema.hasColumn('landlord_statements', 'sent_at'))) {
    await db.schema.alterTable('landlord_statements', (table) => {
      table.timestamp('sent_at').nullable();
      table.string('sent_to', 255).nullable();
    });
    logger.info("Added 'sent_at' and 'sent_to' to 'landlord_statements'.");
  }

  logger.info('Phase 23 database migrations completed successfully.');
};
