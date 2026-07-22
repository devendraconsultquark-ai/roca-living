import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 16 — Property media (spec pages 5–13): photos and floor plans per
// property. Files live under uploads/properties/ and are served through an
// authenticated endpoint, mirroring maintenance_images.
export const runPhase16Migrations = async () => {
  logger.info('Starting Phase 16 database migrations...');

  if (!(await db.schema.hasTable('property_images'))) {
    await db.schema.createTable('property_images', (table) => {
      table.increments('id').primary();
      table.integer('property_id').unsigned().notNullable();
      table.foreign('property_id').references('id').inTable('properties');
      table.enum('image_type', ['photo', 'floor_plan']).notNullable().defaultTo('photo');
      table.string('document_path', 500).notNullable();
      table.string('caption', 255).nullable();
      // Exactly one photo per property may be primary — enforced in the controller.
      table.boolean('is_primary').notNullable().defaultTo(false);
      table.integer('uploaded_by').unsigned().nullable();
      table.foreign('uploaded_by').references('id').inTable('users');
      table.timestamps(true, true);
      table.index(['property_id', 'image_type']);
    });
    logger.info("Table 'property_images' created.");
  }

  logger.info('Phase 16 database migrations run completed successfully!');
};
