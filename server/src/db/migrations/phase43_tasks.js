import db from '../../config/db.js';
import logger from '../../utils/logger.js';

// Phase 43 — tasks: made by admin on the Tasks & Alerts page, assigned to a
// landlord, a tenant or a contractor (or none), optionally about a property.
// Shown on that record's page too. Open tasks due today or overdue join the
// alerts feed (bell, Dashboard).
export const runPhase43Migrations = async () => {
  logger.info('Starting Phase 43 database migrations...');
  if (!(await db.schema.hasTable('tasks'))) {
    await db.schema.createTable('tasks', (t) => {
      t.increments('id').primary();
      t.string('title', 255).notNullable();
      t.text('notes').nullable();
      t.date('due_date').nullable();
      t.enum('priority', ['low', 'normal', 'high']).notNullable().defaultTo('normal');
      t.enum('status', ['todo', 'in_progress', 'done']).notNullable().defaultTo('todo');
      t.datetime('completed_at').nullable();
      t.enum('assignee_type', ['none', 'landlord', 'tenant', 'contractor']).notNullable().defaultTo('none');
      t.integer('assignee_id').unsigned().nullable(); // users.id / tenants.id / contractors.id
      t.integer('property_id').unsigned().nullable();
      t.integer('created_by').unsigned().nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
      t.index(['assignee_type', 'assignee_id']);
      t.index(['property_id']);
      t.index(['status']);
    });
    logger.info('tasks table created');
  }
  // First version (local only) called "not assigned" 'roca_living'.
  const [rows] = await db.raw(
    "SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'assignee_type'"
  );
  if (String(rows?.[0]?.t || '').includes('roca_living')) {
    await db.raw("ALTER TABLE tasks MODIFY assignee_type ENUM('roca_living','none','landlord','tenant','contractor') NOT NULL DEFAULT 'none'");
    await db('tasks').where('assignee_type', 'roca_living').update({ assignee_type: 'none', assignee_id: null });
    await db.raw("ALTER TABLE tasks MODIFY assignee_type ENUM('none','landlord','tenant','contractor') NOT NULL DEFAULT 'none'");
    logger.info("tasks.assignee_type: 'roca_living' → 'none'");
  }
  logger.info('Phase 43 migrations complete');
};
