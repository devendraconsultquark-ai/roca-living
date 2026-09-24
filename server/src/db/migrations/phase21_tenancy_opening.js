import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 21 — opening position for tenancies that were already running (and
// already statemented by hand) before ROCA Living used this system:
//   statements_from     first rent period handled here; earlier rent months
//                       are not created, so they are never shown as owed
//   last_statement_seq  last statement number already issued (PH_33_0003 → 3),
//                       so numbering continues at 0004
export const runPhase21Migrations = async () => {
  logger.info('Starting Phase 21 database migrations...');

  if (!(await db.schema.hasColumn('tenancies', 'statements_from'))) {
    await db.schema.alterTable('tenancies', (table) => {
      table.date('statements_from').nullable();
      table.integer('last_statement_seq').unsigned().nullable();
    });
    logger.info("Added 'statements_from' and 'last_statement_seq' to 'tenancies'.");
  }

  logger.info('Phase 21 database migrations completed successfully.');
};
