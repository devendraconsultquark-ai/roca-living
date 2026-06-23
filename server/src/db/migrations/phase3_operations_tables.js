import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase3Migrations = async () => {
  logger.info('Starting Phase 3 database migrations...');

  // 1. contractors
  if (!(await db.schema.hasTable('contractors'))) {
    await db.schema.createTable('contractors', (table) => {
      table.increments('id').primary();
      table.string('company_name', 255).notNullable();
      table.string('trade', 100).notNullable();
      table.string('contact_name', 255).nullable();
      table.string('email', 255).nullable();
      table.string('phone', 50).nullable();
      table.date('insurance_expiry').nullable();
      table.decimal('rating', 3, 2).nullable();
      table.enum('status', ['active', 'suspended']).defaultTo('active');
      table.tinyint('preferred', 1).defaultTo(0);
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'contractors' created successfully.");
  }

  // 2. maintenance_tickets
  if (!(await db.schema.hasTable('maintenance_tickets'))) {
    await db.schema.createTable('maintenance_tickets', (table) => {
      table.increments('id').primary();
      table.integer('property_id').unsigned().notNullable();
      table.foreign('property_id').references('id').inTable('properties');
      table.integer('tenancy_id').unsigned().nullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies');
      table.integer('reported_by').unsigned().nullable();
      table.foreign('reported_by').references('id').inTable('users');
      table.enum('urgency', ['emergency', 'urgent', 'routine']).notNullable();
      table.string('title', 255).notNullable();
      table.text('description').notNullable();
      table.enum('status', ['new', 'triaged', 'awaiting_approval', 'in_progress', 'complete', 'cancelled']).defaultTo('new');
      table.integer('contractor_id').unsigned().nullable();
      table.foreign('contractor_id').references('id').inTable('contractors');
      table.tinyint('landlord_approved', 1).nullable();
      table.datetime('landlord_approved_at').nullable();
      table.decimal('quote_amount', 10, 2).nullable();
      table.decimal('invoice_amount', 10, 2).nullable();
      table.integer('invoice_document_id').unsigned().nullable();
      table.foreign('invoice_document_id').references('id').inTable('documents');
      table.decimal('spend_threshold_auto_approve', 10, 2).defaultTo(250.00);
      table.datetime('completed_at').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Table 'maintenance_tickets' created successfully.");
  }

  // 3. maintenance_images
  if (!(await db.schema.hasTable('maintenance_images'))) {
    await db.schema.createTable('maintenance_images', (table) => {
      table.increments('id').primary();
      table.integer('ticket_id').unsigned().notNullable();
      table.foreign('ticket_id').references('id').inTable('maintenance_tickets').onDelete('CASCADE');
      table.string('document_path', 500).notNullable();
      table.integer('uploaded_by').unsigned().nullable();
      table.foreign('uploaded_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'maintenance_images' created successfully.");
  }

  // 4. utilities
  if (!(await db.schema.hasTable('utilities'))) {
    await db.schema.createTable('utilities', (table) => {
      table.increments('id').primary();
      table.integer('property_id').unsigned().notNullable();
      table.foreign('property_id').references('id').inTable('properties');
      table.integer('tenancy_id').unsigned().nullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies');
      table.enum('utility_type', ['gas', 'electricity', 'water', 'broadband', 'council_tax', 'tv_licence', 'other']).notNullable();
      table.string('supplier', 255).nullable();
      table.string('account_ref', 255).nullable();
      table.enum('direction', ['into_tenant', 'out_of_tenant', 'to_landlord_void']).notNullable();
      table.tinyint('void_apportioned', 1).defaultTo(0);
      table.tinyint('council_tax_notified', 1).defaultTo(0);
      table.string('meter_reading_in', 100).nullable();
      table.string('meter_reading_out', 100).nullable();
      table.date('handover_date').nullable();
      table.enum('status', ['pending', 'completed', 'disputed']).defaultTo('pending');
      table.text('notes').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Table 'utilities' created successfully.");
  }

  // 5. inspections
  if (!(await db.schema.hasTable('inspections'))) {
    await db.schema.createTable('inspections', (table) => {
      table.increments('id').primary();
      table.integer('property_id').unsigned().notNullable();
      table.foreign('property_id').references('id').inTable('properties');
      table.integer('tenancy_id').unsigned().nullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies');
      table.string('inspected_by', 255).nullable();
      table.datetime('inspected_at').notNullable();
      table.date('next_inspection_due').nullable();
      table.enum('rating', ['excellent', 'good', 'satisfactory', 'unsatisfactory']).nullable();
      table.text('notes').nullable();
      table.integer('document_id').unsigned().nullable();
      table.foreign('document_id').references('id').inTable('documents');
      table.integer('created_by').unsigned().nullable();
      table.foreign('created_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'inspections' created successfully.");
  }

  // 6. fire_safety_signoffs
  if (!(await db.schema.hasTable('fire_safety_signoffs'))) {
    await db.schema.createTable('fire_safety_signoffs', (table) => {
      table.increments('id').primary();
      table.integer('tenancy_id').unsigned().notNullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies');
      table.integer('briefed_by').unsigned().nullable();
      table.foreign('briefed_by').references('id').inTable('users');
      table.datetime('briefed_at').notNullable();
      table.tinyint('tenant_acknowledged', 1).defaultTo(0);
      table.integer('signed_document_id').unsigned().nullable();
      table.foreign('signed_document_id').references('id').inTable('documents');
      table.string('notes', 500).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'fire_safety_signoffs' created successfully.");
  }

  logger.info('Phase 3 database migrations run completed successfully!');
};
