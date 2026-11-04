import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 39 — rent months from before Roca Living (June – October 2026), put
// into Xero as paid invoices / bills / transfers so the client's old bank
// lines can be matched, and kept here as read-only history. Never used for
// approvals, bills, statements or arrears (those use rent_payments).
export const runPhase39Migrations = async () => {
  logger.info('Starting Phase 39 database migrations...');
  if (!(await db.schema.hasTable('rent_history'))) {
    await db.schema.createTable('rent_history', (t) => {
      t.increments('id').primary();
      t.integer('property_id').unsigned().notNullable();
      t.integer('tenancy_id').unsigned().nullable();
      t.string('flat', 20).notNullable();
      t.string('month_label', 7).notNullable(); // YYYY-MM of the first rent received
      t.string('tenant_name', 255).nullable();
      t.string('landlord_name', 255).nullable();
      t.decimal('rent_total', 10, 2).notNullable();
      t.json('parts').notNullable(); // [{ date, amount }]
      t.decimal('fee', 10, 2).notNullable().defaultTo(0);
      t.date('fee_date').nullable();
      t.decimal('repairs', 10, 2).notNullable().defaultTo(0);
      t.json('repair_parts').nullable(); // [{ date, amount, description }]
      t.decimal('landlord_paid', 10, 2).notNullable();
      t.date('paid_on').notNullable();
      t.string('xero_invoice_id', 64).nullable();
      t.string('xero_invoice_number', 50).nullable();
      t.json('xero_invoice_payment_ids').nullable();
      t.string('xero_bill_id', 64).nullable();
      t.string('xero_bill_number', 50).nullable();
      t.string('xero_bill_payment_id', 64).nullable();
      t.json('xero_transfer_ids').nullable(); // fee and repair transfers
      t.string('status', 20).notNullable().defaultTo('started'); // started | done
      t.string('error', 500).nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.unique(['flat', 'month_label'], { indexName: 'uq_rent_history_flat_month' });
      t.index(['property_id'], 'idx_rent_history_property');
      t.index(['tenancy_id'], 'idx_rent_history_tenancy');
    });
    logger.info("Created 'rent_history' table.");
  }
  logger.info('Phase 39 database migrations completed successfully.');
};
