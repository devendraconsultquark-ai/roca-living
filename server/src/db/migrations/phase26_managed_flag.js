import db from '../../config/db.js';
import logger from '../../utils/logger.js';
import { ensurePropertyCompliance } from '../../utils/propertySetup.js';

// Phase 26 — "Managed by ROCA Living" (client handover RL-003): which ROCA
// Estates apartments ROCA Living manages is a flag on Roca Living's own
// property record. Nothing is written to ROCA Estates.
export const runPhase26Migrations = async () => {
  logger.info('Starting Phase 26 database migrations...');

  if (!(await db.schema.hasColumn('properties', 'managed_by_rl'))) {
    await db.schema.alterTable('properties', (table) => {
      table.boolean('managed_by_rl').notNullable().defaultTo(false);
    });
    logger.info("Added 'managed_by_rl' to 'properties'.");

    // Every property that has (or had) a tenancy is a ROCA Living flat today,
    // so nothing changes for the units already being let.
    const updated = await db('properties')
      .whereIn('id', db('tenancies').distinct('property_id'))
      .update({ managed_by_rl: true });
    logger.info(`Marked ${updated} existing let propert${updated === 1 ? 'y' : 'ies'} as managed by ROCA Living.`);
  }

  // Managed properties all get their certificates and checklist (apartments
  // added through Add Tenant before this had none). Only missing rows are added.
  const managedIds = await db('properties').where('managed_by_rl', true).pluck('id');
  let added = 0;
  for (const id of managedIds) {
    const r = await db.transaction((trx) => ensurePropertyCompliance(trx, id));
    added += r.certificates + r.checklist;
  }
  if (added > 0) logger.info(`Added ${added} missing compliance row(s) to managed properties.`);

  logger.info('Phase 26 database migrations completed successfully.');
};
