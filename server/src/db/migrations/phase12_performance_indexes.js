import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Idempotent index creation — checks information_schema so re-runs are safe.
const addIndexIfMissing = async (table, columns, indexName) => {
  const exists = await db('information_schema.statistics')
    .whereRaw('table_schema = DATABASE()')
    .andWhere({ table_name: table, index_name: indexName })
    .first();
  if (exists) return;
  await db.schema.alterTable(table, (t) => t.index(columns, indexName));
  logger.info(`Added index ${indexName} on ${table}(${columns.join(', ')}).`);
};

export const runPhase12Migrations = async () => {
  logger.info('Starting Phase 12 database migrations (performance indexes)...');

  // Polymorphic pointer scanned on every document load and delete cascade (high-cardinality).
  await addIndexIfMissing('documents', ['owner_type', 'owner_id'], 'idx_documents_owner');
  // Range-filtered/ordered during statement generation and payment listings.
  await addIndexIfMissing('rent_payments', ['received_at'], 'idx_rent_payments_received_at');
  // Filtered on 'overdue'/'due' by the arrears job and reports.
  await addIndexIfMissing('rent_schedules', ['status'], 'idx_rent_schedules_status');

  logger.info('Phase 12 migrations completed successfully.');
};
