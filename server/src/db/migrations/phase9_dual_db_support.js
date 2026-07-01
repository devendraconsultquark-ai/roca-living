import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase9Migrations = async () => {
  logger.info('Starting Phase 9 database migrations (dual-DB support)...');

  const dbName = db.client.config.connection.database || process.env.DB_NAME;

  // ─── 1. landlord_statements ───────────────────────────────────────────────

  // 1a. Add source tracking columns
  if (!(await db.schema.hasColumn('landlord_statements', 'source'))) {
    await db.schema.alterTable('landlord_statements', (table) => {
      // 'local' = this DB, 'em' = rocaem DB
      table.enum('source', ['local', 'em']).defaultTo('local').notNullable();
      table.string('source_property_id', 100).nullable();
      // Text snapshot of landlord name/address for EM-sourced records
      table.string('landlord_name', 255).nullable();
      table.string('landlord_address', 500).nullable();
    });
    logger.info("Added source tracking columns to 'landlord_statements'.");
  }

  // 1b. Drop FK on landlord_id (so we can make it nullable)
  const stmtFkRows = await db.raw(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'landlord_statements'
       AND COLUMN_NAME = 'landlord_id' AND REFERENCED_TABLE_NAME = 'users'
     LIMIT 1`,
    [dbName]
  );
  const stmtFkName = stmtFkRows[0]?.[0]?.CONSTRAINT_NAME;
  if (stmtFkName) {
    await db.schema.alterTable('landlord_statements', (table) => {
      table.dropForeign('landlord_id', stmtFkName);
    });
    logger.info(`Dropped FK '${stmtFkName}' from landlord_statements.landlord_id`);
  }

  // 1c. Change landlord_id to nullable
  const stmtIdNullable = await db.raw(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'landlord_statements' AND COLUMN_NAME = 'landlord_id'`,
    [dbName]
  );
  if (stmtIdNullable[0]?.[0]?.IS_NULLABLE === 'NO') {
    await db.schema.alterTable('landlord_statements', (table) => {
      table.integer('landlord_id').unsigned().nullable().alter();
    });
    logger.info("Made 'landlord_statements.landlord_id' nullable.");
  }

  // ─── 2. invoices ─────────────────────────────────────────────────────────

  // 2a. Add source tracking columns to invoices
  if (!(await db.schema.hasColumn('invoices', 'source'))) {
    await db.schema.alterTable('invoices', (table) => {
      table.enum('source', ['local', 'em']).defaultTo('local').notNullable();
      table.string('source_property_id', 100).nullable();
      table.string('landlord_name', 255).nullable();
      table.string('landlord_address', 500).nullable();
    });
    logger.info("Added source tracking columns to 'invoices'.");
  }

  // 2b. Drop FK on invoices.landlord_id
  const invFkRows = await db.raw(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoices'
       AND COLUMN_NAME = 'landlord_id' AND REFERENCED_TABLE_NAME = 'users'
     LIMIT 1`,
    [dbName]
  );
  const invFkName = invFkRows[0]?.[0]?.CONSTRAINT_NAME;
  if (invFkName) {
    await db.schema.alterTable('invoices', (table) => {
      table.dropForeign('landlord_id', invFkName);
    });
    logger.info(`Dropped FK '${invFkName}' from invoices.landlord_id`);
  }

  // 2c. Change invoices.landlord_id to nullable
  const invIdNullable = await db.raw(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'landlord_id'`,
    [dbName]
  );
  if (invIdNullable[0]?.[0]?.IS_NULLABLE === 'NO') {
    await db.schema.alterTable('invoices', (table) => {
      table.integer('landlord_id').unsigned().nullable().alter();
    });
    logger.info("Made 'invoices.landlord_id' nullable.");
  }

  logger.info('Phase 9 migrations completed successfully.');
};
