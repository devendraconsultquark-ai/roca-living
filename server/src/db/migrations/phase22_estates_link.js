import db, { emDb } from '../../config/db.js';
import logger from '../../utils/logger.js';
import { estateUnitCodes, unitKey } from '../../utils/estatesLink.js';

// Phase 22 — link Roca Living's internal lettings records to ROCA Estates
// (rocaem), which now owns blocks, apartments and landlords.
//   properties.rocaem_property_id  → rocaem properties.id
//   users.rocaem_user_id           → rocaem users.id (landlords)
// Existing records are linked by block + apartment number (PH + 33) and by
// landlord email. Rocaem being unreachable only skips the backfill.
export const runPhase22Migrations = async () => {
  logger.info('Starting Phase 22 database migrations...');

  if (!(await db.schema.hasColumn('properties', 'rocaem_property_id'))) {
    await db.schema.alterTable('properties', (table) => {
      table.integer('rocaem_property_id').unsigned().nullable().unique();
    });
    logger.info("Added 'rocaem_property_id' to 'properties'.");
  }
  if (!(await db.schema.hasColumn('users', 'rocaem_user_id'))) {
    await db.schema.alterTable('users', (table) => {
      table.integer('rocaem_user_id').unsigned().nullable().unique();
    });
    logger.info("Added 'rocaem_user_id' to 'users'.");
  }

  try {
    const units = await emDb('properties as p')
      .leftJoin('buildings as b', 'p.building_id', 'b.id')
      .select('p.id', 'p.unit_id', 'p.unit_number', 'b.short_code as building_short_code');
    const byKey = new Map();
    for (const u of units) {
      const { block, apt } = estateUnitCodes(u);
      const key = unitKey(block, apt);
      if (key && !byKey.has(key)) byKey.set(key, u.id);
    }
    const locals = await db('properties').whereNull('rocaem_property_id').whereNotNull('block_name').whereNotNull('apartment_number')
      .select('id', 'block_name', 'apartment_number');
    let linkedProps = 0;
    for (const p of locals) {
      const emId = byKey.get(unitKey(p.block_name, p.apartment_number));
      if (emId && !(await db('properties').where('rocaem_property_id', emId).first())) {
        await db('properties').where('id', p.id).update({ rocaem_property_id: emId });
        linkedProps++;
      }
    }

    const emLandlords = await emDb('users').where('role', 'LANDLORD').whereNotNull('email').select('id', 'email');
    let linkedUsers = 0;
    for (const l of emLandlords) {
      const local = await db('users').where('role', 'LANDLORD').whereNull('rocaem_user_id')
        .whereRaw('LOWER(email) = ?', [l.email.toLowerCase()]).first();
      if (local && !(await db('users').where('rocaem_user_id', l.id).first())) {
        await db('users').where('id', local.id).update({ rocaem_user_id: l.id });
        linkedUsers++;
      }
    }
    logger.info(`Linked ${linkedProps} property(ies) and ${linkedUsers} landlord(s) to ROCA Estates.`);
  } catch (err) {
    logger.warn(`Phase 22: ROCA Estates not reachable, links will be made when tenants are added (${err.message})`);
  }

  logger.info('Phase 22 database migrations completed successfully.');
};
