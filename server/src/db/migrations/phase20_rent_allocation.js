import db from '../../config/db.js';
import logger from '../../utils/logger.js';
import { allocateTenancyPayments } from '../../utils/rentAllocation.js';

// Phase 20 — rent allocation: payments are applied to rent months oldest
// first, months can be part-paid, and surplus is held as tenant credit.
// See utils/rentAllocation.js for the rule.
export const runPhase20Migrations = async () => {
  logger.info('Starting Phase 20 database migrations...');

  if (!(await db.schema.hasColumn('rent_schedules', 'paid_amount'))) {
    await db.schema.alterTable('rent_schedules', (table) => {
      table.decimal('paid_amount', 10, 2).notNullable().defaultTo(0.00);
    });
    logger.info("Added 'paid_amount' to 'rent_schedules'.");
  }

  let created = false;
  if (!(await db.schema.hasTable('rent_payment_allocations'))) {
    await db.schema.createTable('rent_payment_allocations', (table) => {
      table.increments('id').primary();
      table.integer('payment_id').unsigned().notNullable();
      table.foreign('payment_id').references('id').inTable('rent_payments').onDelete('CASCADE');
      table.integer('schedule_id').unsigned().notNullable();
      table.foreign('schedule_id').references('id').inTable('rent_schedules').onDelete('CASCADE');
      table.decimal('amount', 10, 2).notNullable();
      // Set when the money is included on a landlord statement (then frozen).
      table.integer('statement_id').unsigned().nullable();
      table.foreign('statement_id').references('id').inTable('landlord_statements').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.index('schedule_id', 'idx_rpa_schedule');
    });
    created = true;
    logger.info("Created 'rent_payment_allocations' table.");
  }

  // One-off backfill: apply existing payments with the new rule.
  if (created) {
    const tenancies = await db('rent_payments').distinct('tenancy_id');
    for (const { tenancy_id: tenancyId } of tenancies) {
      await db.transaction((trx) => allocateTenancyPayments(trx, tenancyId));
    }
    logger.info(`Allocated existing rent payments for ${tenancies.length} tenancy(ies).`);
  }

  logger.info('Phase 20 database migrations completed successfully.');
};
