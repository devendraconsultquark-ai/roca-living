import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 42 — a certificate can be "Not Required" for a flat (e.g. no gas supply,
// not an HMO, no landlord appliances). It stays on the list but is left out of
// every compliance %. Set by admin on the property Compliance tab.
export const runPhase42Migrations = async () => {
  logger.info('Starting Phase 42 database migrations...');
  const [rows] = await db.raw(
    "SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'property_certificates' AND COLUMN_NAME = 'status'"
  );
  if (rows?.[0] && !String(rows[0].t).includes('not_required')) {
    await db.raw(
      "ALTER TABLE property_certificates MODIFY status ENUM('compliant','expiring_soon','expired','not_uploaded','not_required') NULL DEFAULT 'not_uploaded'"
    );
    logger.info('property_certificates.status: added not_required');
  }
  logger.info('Phase 42 migrations complete');
};
