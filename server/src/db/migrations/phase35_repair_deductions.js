import db from '../../config/db.js';
import logger from '../../utils/logger.js';
import { todayYmd } from '../../utils/dateHelpers.js';

// Phase 35 — a repair approval limit per landlord (default in Settings), and
// completed repairs come off the landlord bill automatically. A Rent
// Cycle deduction can point at the maintenance ticket it came from (once per
// ticket). Only tickets completed from the day this was switched on count:
// older repairs were settled by hand.
export const runPhase35Migrations = async () => {
  logger.info('Starting Phase 35 database migrations...');
  if (!(await db.schema.hasColumn('rent_payment_deductions', 'ticket_id'))) {
    await db.schema.alterTable('rent_payment_deductions', (t) => {
      t.integer('ticket_id').unsigned().nullable();
      t.foreign('ticket_id').references('id').inTable('maintenance_tickets').onDelete('SET NULL');
      t.unique(['ticket_id'], 'uq_rent_payment_deductions_ticket');
    });
    logger.info("Added 'ticket_id' to 'rent_payment_deductions'.");
  }
  // The most ROCA may spend on one repair without asking the landlord first:
  // per landlord (blank = the default in Settings).
  if (!(await db.schema.hasColumn('landlord_profiles', 'repair_limit'))) {
    await db.schema.alterTable('landlord_profiles', (t) => t.decimal('repair_limit', 10, 2).nullable());
    logger.info("Added 'repair_limit' to 'landlord_profiles'.");
  }
  if (!(await db('settings').where('key', 'repairApprovalLimit').first())) {
    await db('settings').insert({ key: 'repairApprovalLimit', value: '250' });
  }
  if (!(await db('settings').where('key', 'repairDeductionsFrom').first())) {
    await db('settings').insert({ key: 'repairDeductionsFrom', value: todayYmd() });
    logger.info(`Repairs completed from ${todayYmd()} are deducted from landlord bills automatically.`);
  }
  logger.info('Phase 35 database migrations completed successfully.');
};
