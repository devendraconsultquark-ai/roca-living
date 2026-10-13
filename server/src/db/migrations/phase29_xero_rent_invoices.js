import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 29 — internal rent invoices in Xero (rent cycle, 12 Oct): one Xero
// invoice per rent month of a managed flat, never sent to the tenant, so Xero's
// bank feed can match the tenant's payment to it. One row per invoice Roca
// Living created; a voided invoice keeps its row (status 'voided') so its number
// is never reused, and the month gets a new numbered invoice.
export const runPhase29Migrations = async () => {
  logger.info('Starting Phase 29 database migrations...');

  if (!(await db.schema.hasTable('xero_rent_invoices'))) {
    await db.schema.createTable('xero_rent_invoices', (table) => {
      table.increments('id').primary();
      table.integer('tenancy_id').unsigned().notNullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies').onDelete('CASCADE');
      table.date('due_date').notNullable();
      table.decimal('amount', 10, 2).notNullable();
      table.string('invoice_number', 50).notNullable();
      table.string('xero_invoice_id', 64).nullable();
      // created = live in Xero · voided = cancelled after the rent month changed
      // failed = Xero refused it (error says why; retried on the next push)
      // attention = rent changed after money was paid against it in Xero
      table.enum('status', ['created', 'voided', 'failed', 'attention']).notNullable().defaultTo('created');
      table.string('error', 500).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
      table.unique(['invoice_number'], 'uq_xero_rent_invoice_number');
      table.index(['tenancy_id', 'due_date'], 'idx_xero_rent_invoice_month');
    });
    logger.info("Created 'xero_rent_invoices' table.");
  }

  // The Xero contact the invoices were raised to (one per tenancy), so later
  // invoices reuse it even if the tenant's name changes.
  if (!(await db.schema.hasColumn('xero_rent_invoices', 'xero_contact_id'))) {
    await db.schema.alterTable('xero_rent_invoices', (table) => {
      table.string('xero_contact_id', 64).nullable();
    });
    logger.info("Added 'xero_contact_id' to 'xero_rent_invoices'.");
  }

  logger.info('Phase 29 database migrations completed successfully.');
};
