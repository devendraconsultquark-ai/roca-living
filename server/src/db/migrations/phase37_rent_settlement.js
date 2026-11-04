import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 37 — rent paid in parts is settled once: the payments of a rent month
// approved together share one landlord bill and one fee transfer. They point at
// the latest of them (the "lead", which carries the deductions).
export const runPhase37Migrations = async () => {
  logger.info('Starting Phase 37 database migrations...');
  if (!(await db.schema.hasColumn('rent_payments', 'settlement_lead_id'))) {
    await db.schema.alterTable('rent_payments', (t) => {
      t.integer('settlement_lead_id').unsigned().nullable();
      t.index(['settlement_lead_id'], 'idx_rent_payments_settlement_lead');
    });
    logger.info("Added 'settlement_lead_id' to 'rent_payments'.");
  }
  logger.info('Phase 37 database migrations completed successfully.');
};
