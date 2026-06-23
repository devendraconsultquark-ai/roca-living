import db from '../../config/db.js';
import logger from '../../utils/logger.js';

export const runPhase4Migrations = async () => {
  logger.info('Starting Phase 4 database migrations...');

  // 1. agent_instructions
  if (!(await db.schema.hasTable('agent_instructions'))) {
    await db.schema.createTable('agent_instructions', (table) => {
      table.increments('id').primary();
      table.integer('agent_id').unsigned().notNullable();
      table.foreign('agent_id').references('id').inTable('letting_agents');
      table.integer('property_id').unsigned().notNullable();
      table.foreign('property_id').references('id').inTable('properties');
      table.integer('landlord_id').unsigned().notNullable();
      table.foreign('landlord_id').references('id').inTable('users');
      table.string('agency_basis', 100).nullable();
      table.enum('agent_fee_basis', ['percentage', 'fixed']).defaultTo('percentage');
      table.decimal('agent_fee_amount', 10, 2).nullable();
      table.decimal('roca_letting_fee', 10, 2).nullable();
      table.decimal('marketing_rent', 10, 2).nullable();
      table.enum('status', ['active', 'completed', 'cancelled']).defaultTo('active');
      table.datetime('instructed_at').defaultTo(db.fn.now());
      table.datetime('completed_at').nullable();
      table.integer('created_by').unsigned().nullable();
      table.foreign('created_by').references('id').inTable('users');
    });
    logger.info("Table 'agent_instructions' created successfully.");
  }

  // 2. viewings
  if (!(await db.schema.hasTable('viewings'))) {
    await db.schema.createTable('viewings', (table) => {
      table.increments('id').primary();
      table.integer('instruction_id').unsigned().notNullable();
      table.foreign('instruction_id').references('id').inTable('agent_instructions').onDelete('CASCADE');
      table.datetime('viewed_at').notNullable();
      table.string('applicant_ref', 255).nullable();
      table.string('applicant_name', 255).nullable();
      table.text('feedback').nullable();
      table.enum('outcome', ['interested', 'not_interested', 'offered', 'no_show']).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info("Table 'viewings' created successfully.");
  }

  logger.info('Phase 4 database migrations run completed successfully!');
};
