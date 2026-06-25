import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase8Migrations = async () => {
  logger.info('Starting Phase 8 database migrations...');

  if (!(await db.schema.hasTable('settings'))) {
    await db.schema.createTable('settings', (table) => {
      table.string('key', 255).primary();
      table.text('value').notNullable();
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
    logger.info("Created 'settings' table.");

    // Insert default settings
    await db('settings').insert([
      { key: 'agencyFee', value: '12.0' },
      { key: 'vatRate', value: '20.0' },
      { key: 'depositSchemeNum', value: 'TDS-ROCA-5001' }
    ]);
    logger.info("Inserted default settings into 'settings' table.");
  } else {
    logger.info("'settings' table already exists.");
  }
};
