import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 34 — the rent due day can change after statements exist. The change
// starts at the next open rent period (the day after the last statement); that
// one period is short (to the day before the first new due day). Remembered so
// statement periods and rent months agree.
export const runPhase34Migrations = async () => {
  logger.info('Starting Phase 34 database migrations...');
  if (!(await db.schema.hasColumn('tenancies', 'rent_due_day_from'))) {
    await db.schema.alterTable('tenancies', (t) => t.date('rent_due_day_from').nullable());
    logger.info("Added 'rent_due_day_from' to 'tenancies'.");
  }
  logger.info('Phase 34 database migrations completed successfully.');
};
