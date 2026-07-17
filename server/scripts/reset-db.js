#!/usr/bin/env node
/**
 * reset-db.js — wipe the primary ROCA database back to a clean slate for manual testing.
 *
 * What it does:
 *   1. TRUNCATEs every table in the primary DB (schema and knex_migrations* are preserved)
 *   2. Re-inserts a single ADMIN user so the admin portal stays accessible
 *      (there is no other way to create an admin — public /register only creates landlords)
 *   3. Empties the uploads/ folder (documents, certificates, invoices, statements,
 *      maintenance images) so no orphaned files reference wiped DB rows
 *
 * What it does NOT touch: the secondary rocaem database, migration state, table schema.
 *
 * Usage (from the server/ directory):
 *   node scripts/reset-db.js                # dry run — shows what would be wiped
 *   node scripts/reset-db.js --yes          # actually reset
 *   npm run reset-db -- --yes               # same, via npm
 *
 * Flags:
 *   --yes            required to actually run (without it, prints a dry-run plan)
 *   --force          additionally required when NODE_ENV=production
 *   --email=...      admin login email   (default admin@rocaliving.com)
 *   --password=...   admin password      (default Admin@12345)
 *   --name=...       admin display name  (default ROCA Admin)
 *   --phone=...      admin phone         (default 07000000000)
 *   --keep-uploads   leave the uploads/ folder untouched
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import knex from 'knex';
import bcrypt from 'bcrypt';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load server/.env explicitly so the script works no matter where it is invoked from.
// (knexfile.js also calls dotenv.config(), but that resolves from cwd; dotenv never
// overrides variables that are already set, so loading the right file first wins.)
dotenv.config({ path: path.join(serverRoot, '.env') });

const { default: knexConfig } = await import('../knexfile.js');

const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12', 10);

const flags = {};
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
  if (!match) {
    console.error(`Unknown argument: ${arg} (flags look like --yes or --email=value)`);
    process.exit(1);
  }
  flags[match[1]] = match[2] === undefined ? true : match[2];
}

const admin = {
  name: flags.name || 'ROCA Admin',
  email: (flags.email || 'admin@rocaliving.com').toLowerCase(),
  password: flags.password || 'Admin@12345',
  phone: flags.phone || '07000000000'
};

const environment = process.env.NODE_ENV || 'development';
if (environment === 'production' && !flags.force) {
  console.error('Refusing to reset a production database. Pass --force as well if you really mean it.');
  process.exit(1);
}

const db = knex(knexConfig[environment]);

try {
  const [[{ dbName }]] = await db.raw('SELECT DATABASE() AS dbName');
  const [tables] = await db.raw(
    `SELECT table_name AS name
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_type = 'BASE TABLE'
       AND table_name NOT LIKE 'knex\\_migrations%'
     ORDER BY table_name`
  );

  const uploadsDir = path.join(serverRoot, 'uploads');
  const willClearUploads = !flags['keep-uploads'] && fs.existsSync(uploadsDir);

  console.log(`Database:    ${dbName} (${environment})`);
  console.log(`Tables:      ${tables.length} will be truncated — ${tables.map(t => t.name).join(', ')}`);
  console.log(`Uploads:     ${willClearUploads ? `contents of ${uploadsDir} will be deleted` : 'untouched'}`);
  console.log(`Admin user:  ${admin.email} will be recreated with role ADMIN`);

  if (!flags.yes) {
    console.log('\nDry run only — nothing was changed. Re-run with --yes to reset.');
    process.exit(0);
  }

  console.log('\nTruncating tables...');
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of tables) {
      await db.raw('TRUNCATE TABLE ??', [table.name]);
    }
  } finally {
    await db.raw('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log('Creating admin user...');
  const hashedPassword = await bcrypt.hash(admin.password, BCRYPT_COST);
  await db('users').insert({
    name: admin.name,
    email: admin.email,
    password: hashedPassword,
    phone: admin.phone,
    address: null,
    role: 'ADMIN'
  });

  if (willClearUploads) {
    console.log('Clearing uploads folder...');
    for (const entry of fs.readdirSync(uploadsDir)) {
      fs.rmSync(path.join(uploadsDir, entry), { recursive: true, force: true });
    }
  }

  console.log('\nDone. Clean slate ready for testing.');
  console.log(`  Admin portal login:  ${admin.email} / ${admin.password}`);
  console.log('  Landlord accounts:   create via admin portal (Register Landlord / Onboarding) or public /register.');
  console.log('  Tip: back up first next time with mysqldump if you did not this time.');
} catch (err) {
  console.error(`Reset failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
