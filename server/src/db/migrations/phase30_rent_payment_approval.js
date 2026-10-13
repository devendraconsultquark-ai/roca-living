import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 30 — rent payments read from Xero (rent cycle phase 3): a payment made
// against one of Roca Living's rent invoices is recorded as rent, and the admin
// approves its split (management fee → ROCA, the rest → landlord).
export const runPhase30Migrations = async () => {
  logger.info('Starting Phase 30 database migrations...');

  const paymentCols = {
    xero_payment_id: (t) => t.string('xero_payment_id', 64).nullable().unique(),
    xero_invoice_number: (t) => t.string('xero_invoice_number', 50).nullable(),
    // true when the Xero payment was tied to a payment the admin had typed in
    xero_linked_existing: (t) => t.boolean('xero_linked_existing').notNullable().defaultTo(false),
    fee_pct: (t) => t.decimal('fee_pct', 5, 2).nullable(),
    fee_amount: (t) => t.decimal('fee_amount', 10, 2).nullable(),
    net_amount: (t) => t.decimal('net_amount', 10, 2).nullable(),
    // null (not part of the approval flow) | pending | approved | attention
    approval_status: (t) => t.string('approval_status', 20).nullable(),
    approved_by: (t) => t.integer('approved_by').unsigned().nullable(),
    approved_at: (t) => t.timestamp('approved_at').nullable(),
    split_note: (t) => t.string('split_note', 500).nullable()
  };
  for (const [col, add] of Object.entries(paymentCols)) {
    if (!(await db.schema.hasColumn('rent_payments', col))) {
      await db.schema.alterTable('rent_payments', add);
      logger.info(`Added '${col}' to 'rent_payments'.`);
    }
  }

  if (!(await db.schema.hasColumn('xero_rent_invoices', 'amount_paid'))) {
    await db.schema.alterTable('xero_rent_invoices', (t) => {
      t.decimal('amount_paid', 10, 2).notNullable().defaultTo(0);
    });
    logger.info("Added 'amount_paid' to 'xero_rent_invoices'.");
  }
  // paid / part: money received against the invoice in Xero.
  await db.raw(
    "ALTER TABLE xero_rent_invoices MODIFY COLUMN status ENUM('created','part','paid','voided','failed','attention') NOT NULL DEFAULT 'created'"
  );

  logger.info('Phase 30 database migrations completed successfully.');
};
