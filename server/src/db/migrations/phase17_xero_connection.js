import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 17 — Xero integration (X1 Connect). Stores the OAuth token set for the
// connected Xero organisation. Tokens are encrypted at rest (utils/secretBox.js);
// the schema allows several rows so a future multi-org setup needs no migration,
// but v1 uses the most recent active connection.
export const runPhase17Migrations = async () => {
  logger.info('Starting Phase 17 database migrations...');

  if (!(await db.schema.hasTable('xero_connections'))) {
    await db.schema.createTable('xero_connections', (table) => {
      table.increments('id').primary();
      table.string('tenant_id', 100).notNullable();
      table.string('tenant_name', 255).nullable();
      // Encrypted token blobs — never stored or logged in plain text.
      table.text('access_token').notNullable();
      table.text('refresh_token').notNullable();
      table.datetime('access_expires_at').nullable();
      table.string('scopes', 500).nullable();
      // 'needs_reauth' when a refresh fails — the UI shows a reconnect banner.
      table.enum('status', ['active', 'needs_reauth', 'disconnected']).notNullable().defaultTo('active');
      table.integer('connected_by').unsigned().nullable();
      table.foreign('connected_by').references('id').inTable('users');
      table.datetime('last_synced_at').nullable();
      table.timestamps(true, true);
      table.index(['status']);
    });
    logger.info("Table 'xero_connections' created.");
  }

  logger.info('Phase 17 database migrations run completed successfully!');
};
