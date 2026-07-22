import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 14 — Rent review tracking on tenancies + admin-curated news items.
// Both back the "Rent Reviews Due" and "Legislation & News" dashboard cards.
export const runPhase14Migrations = async () => {
  logger.info('Starting Phase 14 database migrations...');

  // 1. Rent review fields on tenancies
  if (!(await db.schema.hasColumn('tenancies', 'rent_review_date'))) {
    await db.schema.alterTable('tenancies', (table) => {
      table.date('rent_review_date').nullable();
      table.decimal('proposed_rent', 10, 2).nullable();
      table.enum('rent_review_status', ['none', 'scheduled', 'in_progress', 'completed']).defaultTo('none');
    });
    logger.info("Rent review columns added to 'tenancies'.");
  }

  // 2. news_items — admin-curated legislation & news feed
  if (!(await db.schema.hasTable('news_items'))) {
    await db.schema.createTable('news_items', (table) => {
      table.increments('id').primary();
      table.string('title', 255).notNullable();
      table.string('url', 500).nullable();
      table.date('published_on').notNullable();
      table.enum('status', ['active', 'archived']).defaultTo('active');
      table.integer('created_by').unsigned().nullable();
      table.foreign('created_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Table 'news_items' created successfully.");
  }

  logger.info('Phase 14 database migrations run completed successfully!');
};
