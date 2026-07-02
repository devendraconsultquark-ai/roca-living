import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase11Migrations = async () => {
  logger.info('Starting Phase 11 database migrations (unique references and property names)...');

  // 1. Properties Updates
  if (!(await db.schema.hasColumn('properties', 'property_reference'))) {
    await db.schema.alterTable('properties', (table) => {
      table.string('property_reference', 50).unique().nullable();
      table.string('name', 255).nullable();
    });
    logger.info("Added 'property_reference' and 'name' columns to 'properties' table.");

    const properties = await db('properties').select('id', 'address_line1');
    for (const prop of properties) {
      const ref = `REM-PRP-${String(prop.id).padStart(5, '0')}`;
      await db('properties')
        .where({ id: prop.id })
        .update({
          property_reference: ref,
          name: prop.address_line1
        });
    }
    logger.info("Populated existing properties references and default names.");

    await db.schema.alterTable('properties', (table) => {
      table.string('property_reference', 50).notNullable().alter();
    });
    logger.info("Altered 'properties.property_reference' to NOT NULL.");
  }

  // 2. Documents Updates
  if (!(await db.schema.hasColumn('documents', 'doc_reference'))) {
    await db.schema.alterTable('documents', (table) => {
      table.string('doc_reference', 50).unique().nullable();
    });
    logger.info("Added 'doc_reference' column to 'documents' table.");

    const docs = await db('documents').select('id');
    for (const doc of docs) {
      const ref = `REM-DOC-${String(doc.id).padStart(5, '0')}`;
      await db('documents')
        .where({ id: doc.id })
        .update({ doc_reference: ref });
    }
    logger.info("Populated existing documents references.");

    await db.schema.alterTable('documents', (table) => {
      table.string('doc_reference', 50).notNullable().alter();
    });
    logger.info("Altered 'documents.doc_reference' to NOT NULL.");
  }

  // 3. Landlord Statements Updates
  if (!(await db.schema.hasColumn('landlord_statements', 'statement_reference'))) {
    await db.schema.alterTable('landlord_statements', (table) => {
      table.string('statement_reference', 50).unique().nullable();
    });
    logger.info("Added 'statement_reference' column to 'landlord_statements' table.");

    const statements = await db('landlord_statements').select('id');
    for (const stmt of statements) {
      const ref = `REM-STM-${String(stmt.id).padStart(5, '0')}`;
      await db('landlord_statements')
        .where({ id: stmt.id })
        .update({ statement_reference: ref });
    }
    logger.info("Populated existing statements references.");

    await db.schema.alterTable('landlord_statements', (table) => {
      table.string('statement_reference', 50).notNullable().alter();
    });
    logger.info("Altered 'landlord_statements.statement_reference' to NOT NULL.");
  }

  logger.info('Phase 11 migrations completed successfully.');
};
