import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase7Migrations = async () => {
  logger.info('Starting Phase 7 database migrations...');

  // 1. properties table updates
  if (!(await db.schema.hasColumn('properties', 'block_name'))) {
    await db.schema.alterTable('properties', (table) => {
      table.string('block_name', 255).nullable();
      table.string('apartment_number', 50).nullable();
    });
    logger.info("Added block_name and apartment_number columns to 'properties' table.");
  }

  // 2. landlord_profiles table updates
  if (!(await db.schema.hasColumn('landlord_profiles', 'initials'))) {
    await db.schema.alterTable('landlord_profiles', (table) => {
      table.string('initials', 50).nullable();
      table.string('nrl_number', 100).nullable();
    });
    logger.info("Added initials and nrl_number columns to 'landlord_profiles' table.");
  }

  // 3. landlord_statements table updates
  if (!(await db.schema.hasColumn('landlord_statements', 'statement_number'))) {
    await db.schema.alterTable('landlord_statements', (table) => {
      table.string('statement_number', 255).nullable();
      table.string('tenant_name', 255).nullable();
      table.string('tenancy_type', 255).nullable();
      table.date('tenancy_start_date').nullable();
      table.decimal('void_period_credit', 10, 2).defaultTo(0.00);
      table.string('exp_invoice_no', 255).nullable();
      table.decimal('exp_amount', 10, 2).defaultTo(0.00);
      table.decimal('setup_rebate', 10, 2).defaultTo(0.00);
      table.decimal('previous_balance', 10, 2).defaultTo(0.00);
    });
    logger.info("Added metadata columns to 'landlord_statements' table.");
  }

  // 4. invoices table creation
  if (!(await db.schema.hasTable('invoices'))) {
    await db.schema.createTable('invoices', (table) => {
      table.increments('id').primary();
      table.integer('landlord_id').unsigned().notNullable();
      table.foreign('landlord_id').references('id').inTable('users').onDelete('CASCADE');
      table.integer('property_id').unsigned().nullable();
      table.foreign('property_id').references('id').inTable('properties').onDelete('SET NULL');
      table.string('invoice_number', 100).unique().notNullable();
      table.date('period_start').nullable();
      table.date('period_end').nullable();
      table.string('service_level', 255).defaultTo('Fully Managed');
      table.string('tenant_name', 255).nullable();
      table.date('tenancy_start_date').nullable();
      table.decimal('total_gross', 10, 2).notNullable().defaultTo(0.00);
      table.decimal('total_vat', 10, 2).notNullable().defaultTo(0.00);
      table.decimal('total_discount', 10, 2).notNullable().defaultTo(0.00);
      table.decimal('total_net', 10, 2).notNullable().defaultTo(0.00);
      table.text('notes').nullable();
      table.enum('status', ['draft', 'sent', 'paid', 'voided']).defaultTo('draft');
      table.integer('document_id').unsigned().nullable();
      table.foreign('document_id').references('id').inTable('documents').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Created 'invoices' table.");
  }

  // 5. invoice_items table creation
  if (!(await db.schema.hasTable('invoice_items'))) {
    await db.schema.createTable('invoice_items', (table) => {
      table.increments('id').primary();
      table.integer('invoice_id').unsigned().notNullable();
      table.foreign('invoice_id').references('id').inTable('invoices').onDelete('CASCADE');
      table.string('description', 500).notNullable();
      table.decimal('cost', 10, 2).notNullable().defaultTo(0.00);
      table.decimal('vat_percent', 10, 2).notNullable().defaultTo(0.00);
      table.decimal('discount', 10, 2).notNullable().defaultTo(0.00);
      table.decimal('net', 10, 2).notNullable().defaultTo(0.00);
    });
    logger.info("Created 'invoice_items' table.");
  }

  logger.info('Phase 7 database migrations completed successfully.');
};
