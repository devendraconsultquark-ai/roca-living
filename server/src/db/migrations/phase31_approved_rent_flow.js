import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 31 — the separate "approved rent" flow (rent cycle phase 4), next to the
// existing statements, which are not changed:
//  • approved rent can be sent to Xero as a bill to the landlord (rent − fee);
//  • "Statement from approved rent" builds a landlord statement from approved
//    payments only, with its own numbering (AR-PH_08_0001).
export const runPhase31Migrations = async () => {
  logger.info('Starting Phase 31 database migrations...');

  const cols = {
    xero_bill_id: (t) => t.string('xero_bill_id', 64).nullable(),
    xero_bill_number: (t) => t.string('xero_bill_number', 50).nullable(),
    // null | posted | paid | voided | failed
    xero_bill_status: (t) => t.string('xero_bill_status', 20).nullable(),
    xero_bill_error: (t) => t.string('xero_bill_error', 500).nullable(),
    landlord_paid_at: (t) => t.date('landlord_paid_at').nullable(),
    approved_statement_id: (t) => t.integer('approved_statement_id').unsigned().nullable()
  };
  for (const [col, add] of Object.entries(cols)) {
    if (!(await db.schema.hasColumn('rent_payments', col))) {
      await db.schema.alterTable('rent_payments', add);
      logger.info(`Added '${col}' to 'rent_payments'.`);
    }
  }

  if (!(await db.schema.hasTable('approved_rent_statements'))) {
    await db.schema.createTable('approved_rent_statements', (table) => {
      table.increments('id').primary();
      table.string('statement_number', 50).notNullable().unique();
      table.string('invoice_number', 60).nullable();
      table.integer('tenancy_id').unsigned().notNullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies').onDelete('CASCADE');
      table.integer('property_id').unsigned().notNullable();
      table.integer('landlord_id').unsigned().nullable();
      table.date('period_start').notNullable();
      table.date('period_end').notNullable();
      table.decimal('total_rent', 10, 2).notNullable();
      table.decimal('total_fee', 10, 2).notNullable();
      table.decimal('net_payout', 10, 2).notNullable();
      table.string('landlord_name', 255).nullable();
      table.integer('document_id').unsigned().nullable();
      table.enum('status', ['draft', 'issued']).notNullable().defaultTo('draft');
      table.integer('created_by').unsigned().nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.index(['tenancy_id'], 'idx_approved_rent_statement_tenancy');
    });
    logger.info("Created 'approved_rent_statements' table.");
  }

  logger.info('Phase 31 database migrations completed successfully.');
};
