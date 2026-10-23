import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 33 — ROCA Estates holds landlord and apartment documents and every
// certificate; Roca Living's rows are kept in step with it. Each mirrored
// document remembers its ROCA Estates id, and each certificate the ROCA Estates
// file it last saw (so a file changed there is picked up here).
export const runPhase33Migrations = async () => {
  logger.info('Starting Phase 33 database migrations...');

  if (!(await db.schema.hasColumn('documents', 'rocaem_document_id'))) {
    await db.schema.alterTable('documents', (t) => {
      t.integer('rocaem_document_id').unsigned().nullable().unique();
    });
    logger.info("Added 'rocaem_document_id' to 'documents'.");
  }

  // ROCA Estates documents marked internal stay off the landlord portal.
  if (!(await db.schema.hasColumn('documents', 'landlord_visible'))) {
    await db.schema.alterTable('documents', (t) => t.boolean('landlord_visible').notNullable().defaultTo(true));
    logger.info("Added 'landlord_visible' to 'documents'.");
  }

  if (!(await db.schema.hasColumn('property_certificates', 'estates_file'))) {
    await db.schema.alterTable('property_certificates', (t) => t.string('estates_file', 255).nullable());
    logger.info("Added 'estates_file' to 'property_certificates'.");
  }

  // The apartment's floor plan lives in ROCA Estates (one per apartment).
  if (!(await db.schema.hasColumn('property_images', 'estates_file'))) {
    await db.schema.alterTable('property_images', (t) => t.string('estates_file', 255).nullable());
    logger.info("Added 'estates_file' to 'property_images'.");
  }

  logger.info('Phase 33 database migrations completed successfully.');
};
