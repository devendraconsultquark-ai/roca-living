import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase1Migrations = async () => {
  logger.info('Starting Phase 1 database migrations...');

  // 1. landlord_profiles
  if (!(await db.schema.hasTable('landlord_profiles'))) {
    await db.schema.createTable('landlord_profiles', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().unique();
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('company_name', 255).nullable();
      table.tinyint('is_overseas', 1).defaultTo(0);
      table.tinyint('nrl_hmrc_approved', 1).defaultTo(0);
      table.string('nrl_hmrc_ref', 100).nullable();
      table.decimal('nrl_withhold_pct', 5, 2).defaultTo(20.00);
      table.enum('kyc_status', ['not_started', 'pending', 'passed', 'failed']).defaultTo('not_started');
      table.string('kyc_provider', 50).defaultTo('HIPLA');
      table.string('kyc_ref', 100).nullable();
      table.tinyint('sanctions_checked', 1).defaultTo(0);
      table.enum('tob_status', ['not_sent', 'sent', 'signed']).defaultTo('not_sent');
      table.datetime('tob_signed_at').nullable();
      table.tinyint('ownership_confirmed', 1).defaultTo(0);
      table.decimal('ownership_share', 5, 2).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Table 'landlord_profiles' created successfully.");
  }

  // 2. landlord_payment_details
  if (!(await db.schema.hasTable('landlord_payment_details'))) {
    await db.schema.createTable('landlord_payment_details', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().unique();
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('bank_name', 255).notNullable();
      table.string('account_name', 255).notNullable();
      table.string('account_number', 20).notNullable();
      table.string('sort_code', 10).notNullable();
      table.string('iban_bic', 50).nullable();
      table.datetime('verified_at').nullable();
      table.tinyint('change_pending', 1).defaultTo(0);
      table.datetime('change_requested_at').nullable();
      table.integer('change_verified_by').unsigned().nullable();
      table.foreign('change_verified_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Table 'landlord_payment_details' created successfully.");
  }

  // 3. properties
  if (!(await db.schema.hasTable('properties'))) {
    await db.schema.createTable('properties', (table) => {
      table.increments('id').primary();
      table.integer('landlord_id').unsigned().notNullable();
      table.foreign('landlord_id').references('id').inTable('users');
      table.string('address_line1', 255).notNullable();
      table.string('address_line2', 255).nullable();
      table.string('city', 100).notNullable();
      table.string('postcode', 20).notNullable();
      table.string('property_type', 50).nullable();
      table.integer('bedrooms').nullable();
      table.enum('status', ['onboarding', 'vacant', 'let']).defaultTo('onboarding');
      table.decimal('rent_pcm', 10, 2).nullable();
      table.decimal('mgmt_fee_pct', 5, 2).defaultTo(12.00);
      table.string('key_ref', 100).nullable();
      table.text('notes').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Table 'properties' created successfully.");
  }

  // 4. property_certificates
  if (!(await db.schema.hasTable('property_certificates'))) {
    await db.schema.createTable('property_certificates', (table) => {
      table.increments('id').primary();
      table.integer('property_id').unsigned().notNullable();
      table.foreign('property_id').references('id').inTable('properties').onDelete('CASCADE');
      table.enum('cert_type', ['EPC', 'EICR', 'GAS', 'SMOKE_CO', 'HMO', 'PAT']).notNullable();
      table.date('issued_at').nullable();
      table.date('expires_at').nullable();
      table.enum('status', ['compliant', 'expiring_soon', 'expired', 'not_uploaded']).defaultTo('not_uploaded');
      table.string('document_path', 500).nullable();
      table.string('notes', 500).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Table 'property_certificates' created successfully.");
  }

  // 5. compliance_checklist
  if (!(await db.schema.hasTable('compliance_checklist'))) {
    await db.schema.createTable('compliance_checklist', (table) => {
      table.increments('id').primary();
      table.enum('scope', ['landlord', 'property']).notNullable();
      table.integer('entity_id').unsigned().notNullable();
      table.string('item_code', 50).notNullable();
      table.string('item_label', 255).notNullable();
      table.tinyint('applicable', 1).defaultTo(1);
      table.enum('status', ['pending', 'complete', 'not_applicable']).defaultTo('pending');
      table.string('document_path', 500).nullable();
      table.datetime('verified_at').nullable();
      table.integer('verified_by').unsigned().nullable();
      table.foreign('verified_by').references('id').inTable('users');
      table.string('notes', 500).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      
      table.unique(['scope', 'entity_id', 'item_code'], 'uq_checklist');
    });
    logger.info("Table 'compliance_checklist' created successfully.");
  }

  // 6. folders
  if (!(await db.schema.hasTable('folders'))) {
    await db.schema.createTable('folders', (table) => {
      table.increments('id').primary();
      table.integer('parent_id').unsigned().nullable();
      table.foreign('parent_id').references('id').inTable('folders');
      table.string('name', 255).notNullable();
      table.enum('owner_type', ['landlord', 'property', 'tenancy', 'global']).notNullable();
      table.integer('owner_id').unsigned().nullable();
      table.integer('created_by').unsigned().nullable();
      table.foreign('created_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'folders' created successfully.");
  }

  // 7. documents
  if (!(await db.schema.hasTable('documents'))) {
    await db.schema.createTable('documents', (table) => {
      table.increments('id').primary();
      table.integer('folder_id').unsigned().nullable();
      table.foreign('folder_id').references('id').inTable('folders');
      table.enum('owner_type', ['landlord', 'property', 'tenancy', 'global']).notNullable();
      table.integer('owner_id').unsigned().notNullable();
      table.string('doc_type', 100).nullable();
      table.string('filename', 255).notNullable();
      table.string('original_name', 255).notNullable();
      table.string('mime_type', 100).nullable();
      table.string('file_path', 500).notNullable();
      table.integer('file_size_bytes').nullable();
      table.integer('uploaded_by').unsigned().nullable();
      table.foreign('uploaded_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'documents' created successfully.");
  }

  // 8. invitation_tokens
  if (!(await db.schema.hasTable('invitation_tokens'))) {
    await db.schema.createTable('invitation_tokens', (table) => {
      table.increments('id').primary();
      table.string('email', 255).notNullable();
      table.enum('role', ['ADMIN', 'LANDLORD', 'AGENT']).notNullable();
      table.string('token', 255).notNullable().unique();
      table.integer('landlord_id').unsigned().nullable();
      table.foreign('landlord_id').references('id').inTable('users');
      table.datetime('expires_at').notNullable();
      table.datetime('used_at').nullable();
      table.integer('created_by').unsigned().nullable();
      table.foreign('created_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'invitation_tokens' created successfully.");
  }

  // 9. audit_log
  if (!(await db.schema.hasTable('audit_log'))) {
    await db.schema.createTable('audit_log', (table) => {
      table.increments('id').primary();
      table.integer('actor_id').unsigned().nullable();
      table.foreign('actor_id').references('id').inTable('users');
      table.string('actor_role', 20).nullable();
      table.string('action', 100).notNullable();
      table.string('entity_type', 50).nullable();
      table.integer('entity_id').unsigned().nullable();
      table.json('meta').nullable();
      table.string('ip_address', 50).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());

      table.index(['entity_type', 'entity_id'], 'idx_audit_entity');
      table.index('actor_id', 'idx_audit_actor');
    });
    logger.info("Table 'audit_log' created successfully.");
  }

  logger.info('Phase 1 database migrations run completed successfully!');
};
