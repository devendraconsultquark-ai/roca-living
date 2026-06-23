import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase2Migrations = async () => {
  logger.info('Starting Phase 2 database migrations...');

  // 1. letting_agents
  if (!(await db.schema.hasTable('letting_agents'))) {
    await db.schema.createTable('letting_agents', (table) => {
      table.increments('id').primary();
      table.string('company_name', 255).notNullable();
      table.string('contact_name', 255).nullable();
      table.string('email', 255).nullable();
      table.string('phone', 50).nullable();
      table.string('redress_scheme', 100).nullable();
      table.string('cmp_provider', 100).nullable();
      table.enum('status', ['active', 'suspended']).defaultTo('active');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'letting_agents' created successfully.");
  }

  // 2. tenancies
  if (!(await db.schema.hasTable('tenancies'))) {
    await db.schema.createTable('tenancies', (table) => {
      table.increments('id').primary();
      table.integer('property_id').unsigned().notNullable();
      table.foreign('property_id').references('id').inTable('properties');
      table.enum('status', ['active', 'notice', 'ended', 'pending']).defaultTo('pending');
      table.date('start_date').notNullable();
      table.date('end_date').nullable();
      table.decimal('rent_pcm', 10, 2).notNullable();
      table.enum('rent_frequency', ['monthly', 'weekly']).defaultTo('monthly');
      table.decimal('agent_letting_fee', 10, 2).nullable();
      table.decimal('roca_letting_fee', 10, 2).nullable();
      table.integer('created_by').unsigned().nullable();
      table.foreign('created_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Table 'tenancies' created successfully.");
  }

  // 3. tenants
  if (!(await db.schema.hasTable('tenants'))) {
    await db.schema.createTable('tenants', (table) => {
      table.increments('id').primary();
      table.integer('tenancy_id').unsigned().notNullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies').onDelete('CASCADE');
      table.string('name', 255).notNullable();
      table.string('email', 255).nullable();
      table.string('phone', 50).nullable();
      table.tinyint('is_lead_tenant', 1).defaultTo(0);
      table.enum('right_to_rent_status', ['verified', 'pending', 'failed']).defaultTo('pending');
      table.date('right_to_rent_expiry').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'tenants' created successfully.");
  }

  // 4. deposits
  if (!(await db.schema.hasTable('deposits'))) {
    await db.schema.createTable('deposits', (table) => {
      table.increments('id').primary();
      table.integer('tenancy_id').unsigned().notNullable().unique();
      table.foreign('tenancy_id').references('id').inTable('tenancies');
      table.decimal('holding_deposit', 10, 2).nullable();
      table.decimal('tenancy_deposit', 10, 2).notNullable();
      table.enum('scheme', ['TDS', 'DPS', 'mydeposits']).defaultTo('TDS');
      table.date('received_at').notNullable();
      table.date('register_due').notNullable();
      table.date('registered_at').nullable();
      table.date('prescribed_info_served_at').nullable();
      table.enum('status', ['pending_registration', 'registered', 'returned', 'disputed', 'deducted']).defaultTo('pending_registration');
      table.text('notes').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    logger.info("Table 'deposits' created successfully.");
  }

  // 5. rent_schedules
  if (!(await db.schema.hasTable('rent_schedules'))) {
    await db.schema.createTable('rent_schedules', (table) => {
      table.increments('id').primary();
      table.integer('tenancy_id').unsigned().notNullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies');
      table.date('due_date').notNullable();
      table.decimal('amount', 10, 2).notNullable();
      table.enum('status', ['due', 'paid', 'partial', 'overdue']).defaultTo('due');
      table.timestamp('created_at').defaultTo(db.fn.now());
      
      table.index('tenancy_id', 'idx_rent_schedule_tenancy');
      table.index('due_date', 'idx_rent_schedule_due');
    });
    logger.info("Table 'rent_schedules' created successfully.");
  }

  // 6. rent_payments
  if (!(await db.schema.hasTable('rent_payments'))) {
    await db.schema.createTable('rent_payments', (table) => {
      table.increments('id').primary();
      table.integer('tenancy_id').unsigned().notNullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies');
      table.integer('schedule_id').unsigned().nullable();
      table.foreign('schedule_id').references('id').inTable('rent_schedules');
      table.date('received_at').notNullable();
      table.decimal('amount', 10, 2).notNullable();
      table.enum('method', ['bank_transfer', 'direct_debit', 'card', 'cash', 'other']).defaultTo('bank_transfer');
      table.string('reference', 255).nullable();
      table.tinyint('reconciled', 1).defaultTo(0);
      table.datetime('reconciled_at').nullable();
      table.integer('reconciled_by').unsigned().nullable();
      table.foreign('reconciled_by').references('id').inTable('users');
      table.string('notes', 500).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'rent_payments' created successfully.");
  }

  // 7. transactions
  if (!(await db.schema.hasTable('transactions'))) {
    await db.schema.createTable('transactions', (table) => {
      table.increments('id').primary();
      table.enum('type', [
        'rent_in',
        'mgmt_fee',
        'vat',
        'agent_letting_fee',
        'roca_letting_fee',
        'contractor_cost',
        'nrl_withholding',
        'landlord_payout',
        'deduction',
        'other'
      ]).notNullable();
      table.integer('property_id').unsigned().nullable();
      table.foreign('property_id').references('id').inTable('properties');
      table.integer('landlord_id').unsigned().nullable();
      table.foreign('landlord_id').references('id').inTable('users');
      table.integer('tenancy_id').unsigned().nullable();
      table.foreign('tenancy_id').references('id').inTable('tenancies');
      table.integer('statement_id').unsigned().nullable();
      table.decimal('amount', 10, 2).notNullable();
      table.decimal('vat_amount', 10, 2).defaultTo(0.00);
      table.string('description', 500).nullable();
      table.date('transaction_date').notNullable();
      table.tinyint('reconciled', 1).defaultTo(0);
      table.integer('created_by').unsigned().nullable();
      table.foreign('created_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());

      table.index('landlord_id', 'idx_transactions_landlord');
      table.index('property_id', 'idx_transactions_property');
      table.index('transaction_date', 'idx_transactions_date');
    });
    logger.info("Table 'transactions' created successfully.");
  }

  // 8. landlord_statements
  if (!(await db.schema.hasTable('landlord_statements'))) {
    await db.schema.createTable('landlord_statements', (table) => {
      table.increments('id').primary();
      table.integer('landlord_id').unsigned().notNullable();
      table.foreign('landlord_id').references('id').inTable('users');
      table.date('period_start').notNullable();
      table.date('period_end').notNullable();
      table.decimal('gross_rent', 10, 2).notNullable();
      table.decimal('mgmt_fee', 10, 2).notNullable();
      table.decimal('mgmt_fee_vat', 10, 2).notNullable();
      table.decimal('roca_letting_fee', 10, 2).defaultTo(0.00);
      table.decimal('agent_letting_fee', 10, 2).defaultTo(0.00);
      table.decimal('deductions', 10, 2).defaultTo(0.00);
      table.decimal('nrl_withheld', 10, 2).defaultTo(0.00);
      table.decimal('net_paid', 10, 2).notNullable();
      table.integer('document_id').unsigned().nullable();
      table.foreign('document_id').references('id').inTable('documents');
      table.enum('status', ['draft', 'sent', 'paid']).defaultTo('draft');
      table.datetime('generated_at').nullable();
      table.datetime('paid_at').nullable();
      table.integer('generated_by').unsigned().nullable();
      table.foreign('generated_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'landlord_statements' created successfully.");
  }

  // 9. Add FK to transactions referencing landlord_statements
  const dbName = db.client.config.connection.database || process.env.DB_NAME;
  const constraints = await db.raw(
    `SELECT * FROM information_schema.referential_constraints WHERE constraint_schema = ? AND constraint_name = ?`,
    [dbName, 'fk_transactions_statement']
  );

  if (constraints[0].length === 0) {
    await db.schema.alterTable('transactions', (table) => {
      table.foreign('statement_id', 'fk_transactions_statement')
        .references('id')
        .inTable('landlord_statements')
        .onDelete('SET NULL');
    });
    logger.info("Foreign key constraint 'fk_transactions_statement' added to transactions successfully.");
  }

  logger.info('Phase 2 database migrations run completed successfully!');
};
