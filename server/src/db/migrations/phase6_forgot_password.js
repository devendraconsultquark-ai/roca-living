import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase6Migrations = async () => {
  logger.info('Starting Phase 6 database migrations...');

  if (!(await db.schema.hasColumn('users', 'password_reset_token'))) {
    await db.schema.alterTable('users', (table) => {
      table.string('password_reset_token', 255).nullable();
      table.datetime('password_reset_expires').nullable();
    });
    logger.info("Added password reset columns to 'users' table.");
  } else {
    logger.info("Password reset columns already exist on 'users' table.");
  }
};
