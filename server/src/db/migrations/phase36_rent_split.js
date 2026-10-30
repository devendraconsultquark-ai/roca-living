import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 36 — the rent split on approval (Rent Cycle): besides the landlord bill,
// each repair deduction gets a bill to its contractor in Xero, and ROCA's fee is
// recorded as a bank transfer from the rent (client) account to ROCA's own.
export const runPhase36Migrations = async () => {
  logger.info('Starting Phase 36 database migrations...');

  // A repair line's bill to the contractor (one per line, i.e. per ticket).
  const dedCols = {
    xero_bill_id: (t) => t.string('xero_bill_id', 64).nullable(),
    xero_bill_number: (t) => t.string('xero_bill_number', 64).nullable(),
    xero_bill_status: (t) => t.string('xero_bill_status', 16).nullable(), // posted | paid | failed | voided
    xero_bill_error: (t) => t.string('xero_bill_error', 500).nullable(),
    paid_at: (t) => t.date('paid_at').nullable(),
  };
  for (const [col, add] of Object.entries(dedCols)) {
    if (!(await db.schema.hasColumn('rent_payment_deductions', col))) {
      await db.schema.alterTable('rent_payment_deductions', (t) => add(t));
      logger.info(`Added '${col}' to 'rent_payment_deductions'.`);
    }
  }

  // ROCA's fee moved to ROCA's account (a Xero bank transfer), once per payment.
  const payCols = {
    fee_transfer_id: (t) => t.string('fee_transfer_id', 64).nullable(),
    fee_transfer_status: (t) => t.string('fee_transfer_status', 16).nullable(), // done | failed | skipped
    fee_transfer_error: (t) => t.string('fee_transfer_error', 500).nullable(),
  };
  for (const [col, add] of Object.entries(payCols)) {
    if (!(await db.schema.hasColumn('rent_payments', col))) {
      await db.schema.alterTable('rent_payments', (t) => add(t));
      logger.info(`Added '${col}' to 'rent_payments'.`);
    }
  }

  // Contractors become Xero contacts too.
  const [kind] = await db.raw("SHOW COLUMNS FROM xero_contact_links WHERE Field = 'kind'");
  if (kind[0] && !String(kind[0].Type).includes("'contractor'")) {
    await db.raw("ALTER TABLE xero_contact_links MODIFY kind ENUM('tenant','landlord','contractor') NOT NULL");
    logger.info("xero_contact_links.kind now allows 'contractor'.");
  }
  if (!(await db.schema.hasColumn('xero_contact_links', 'contractor_id'))) {
    await db.schema.alterTable('xero_contact_links', (t) => t.integer('contractor_id').unsigned().nullable());
    logger.info("Added 'contractor_id' to 'xero_contact_links'.");
  }

  logger.info('Phase 36 database migrations completed successfully.');
};
