import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 19 — Xero bank transactions (money in and out), reconciled to tenant
// rent, landlord payouts or property expenses. Mirrors the rocaem
// reconciliation model: import → auto-match when certain → admin reconciles
// the rest → a ROCA record is created. Payers/payees the admin links are
// remembered so the same contact auto-matches next time.
export const runPhase19Migrations = async () => {
  logger.info('Starting Phase 19 database migrations...');

  // Which Xero bank accounts are imported (e.g. the PH rent account).
  if (!(await db.schema.hasTable('xero_import_accounts'))) {
    await db.schema.createTable('xero_import_accounts', (table) => {
      table.increments('id').primary();
      table.string('xero_account_id', 64).notNullable().unique();
      table.string('name', 255).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Created 'xero_import_accounts' table.");
  }

  if (!(await db.schema.hasTable('xero_bank_transactions'))) {
    await db.schema.createTable('xero_bank_transactions', (table) => {
      table.increments('id').primary();
      table.string('xero_transaction_id', 64).notNullable().unique();
      table.string('xero_account_id', 64).nullable();
      table.string('account_name', 255).nullable();
      table.string('xero_type', 40).nullable();
      table.enum('direction', ['in', 'out']).notNullable();
      table.date('date').notNullable();
      table.decimal('amount', 12, 2).notNullable(); // always positive; direction gives the sign
      table.string('reference', 500).nullable();
      table.string('contact_id', 64).nullable();
      table.string('contact_name', 255).nullable();
      table.enum('status', ['unreconciled', 'reconciled', 'ignored']).notNullable().defaultTo('unreconciled');
      table.enum('reconciled_as', ['tenant_rent', 'landlord_payout', 'property_expense']).nullable();
      table.integer('tenancy_id').unsigned().nullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies').onDelete('SET NULL');
      table.integer('landlord_id').unsigned().nullable();
      table.integer('property_id').unsigned().nullable();
      table.foreign('property_id').references('id').inTable('properties').onDelete('SET NULL');
      table.integer('rent_payment_id').unsigned().nullable();
      table.integer('ledger_transaction_id').unsigned().nullable();
      // landlord_payout: statement ids + their previous status, so Undo can restore them
      table.text('link_meta').nullable();
      table.boolean('auto_matched').notNullable().defaultTo(false);
      table.string('note', 500).nullable();
      table.integer('reconciled_by').unsigned().nullable();
      table.datetime('reconciled_at').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.index(['status', 'direction'], 'idx_xbt_status_direction');
      table.index('date', 'idx_xbt_date');
      table.index(['property_id', 'reconciled_as'], 'idx_xbt_property_kind');
    });
    logger.info("Created 'xero_bank_transactions' table.");
  }

  // Remembered Xero contacts: a payer linked to a tenancy, or a payee linked to a landlord.
  if (!(await db.schema.hasTable('xero_contact_links'))) {
    await db.schema.createTable('xero_contact_links', (table) => {
      table.increments('id').primary();
      table.string('xero_contact_id', 64).notNullable();
      table.enum('kind', ['tenant', 'landlord']).notNullable();
      table.integer('tenancy_id').unsigned().nullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies').onDelete('CASCADE');
      table.integer('landlord_id').unsigned().nullable();
      table.integer('created_by').unsigned().nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.unique(['xero_contact_id', 'kind'], 'uq_xero_contact_kind');
    });
    logger.info("Created 'xero_contact_links' table.");
  }

  logger.info('Phase 19 database migrations completed successfully.');
};
