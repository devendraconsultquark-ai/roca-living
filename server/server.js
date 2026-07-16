import dotenv from "dotenv/config"; // reload trigger
import { app } from "./app.js";
import logger from "./src/utils/logger.js";
import pool, { verifyDbConnection } from "./src/config/db.js";
import { runPhase1Migrations } from './src/db/migrations/phase1_tables.js';
import { runPhase2Migrations } from './src/db/migrations/phase2_accounting_tables.js';
import { runPhase3Migrations } from './src/db/migrations/phase3_operations_tables.js';
import { runPhase4Migrations } from './src/db/migrations/phase4_agents_tables.js';
import { runPhase6Migrations } from './src/db/migrations/phase6_forgot_password.js';
import { runPhase7Migrations } from './src/db/migrations/phase7_statement_metadata.js';
import { runPhase8Migrations } from './src/db/migrations/phase8_settings.js';
import { runPhase9Migrations } from './src/db/migrations/phase9_dual_db_support.js';
import { runPhase10Migrations } from './src/db/migrations/phase10_landlord_reference.js';
import { runPhase11Migrations } from './src/db/migrations/phase11_unique_references.js';
import { runPhase12Migrations } from './src/db/migrations/phase12_performance_indexes.js';
import { runPhase13Migrations } from './src/db/migrations/phase13_data_consistency.js';
import { startScheduler } from './src/jobs/scheduler.js';
import { ensurePuppeteerDependencies } from './src/utils/puppeteerGenerator.js';
const PORT = Number(process.env.PORT) || 9000;

// Validate required environment variables at boot — fail fast with a clear message
// rather than failing late and opaquely (undefined DB creds, NaN ports, etc.).
const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  logger.error(`FATAL ERROR: missing required environment variable(s): ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Verify DB first, then start server
const startServer = async () => {
  const dbConnected = await verifyDbConnection();
  if (!dbConnected && process.env.NODE_ENV === 'production') {
    logger.error("Database is not reachable. Exiting server...");
    process.exit(1);
  }

  await runPhase1Migrations();
  logger.info('Phase 1 migrations complete');

  await runPhase2Migrations();
  logger.info('Phase 2 migrations complete');

  await runPhase3Migrations();
  logger.info('Phase 3 migrations complete');

  await runPhase4Migrations();
  logger.info('Phase 4 migrations complete');

  await runPhase6Migrations();
  logger.info('Phase 6 migrations complete');

  await runPhase7Migrations();
  logger.info('Phase 7 migrations complete');

  await runPhase8Migrations();
  logger.info('Phase 8 migrations complete');

  await runPhase9Migrations();
  logger.info('Phase 9 migrations complete');

  await runPhase10Migrations();
  logger.info('Phase 10 migrations complete');

  await runPhase11Migrations();
  logger.info('Phase 11 migrations complete');

  await runPhase12Migrations();
  logger.info('Phase 12 migrations complete');

  await runPhase13Migrations();
  logger.info('Phase 13 migrations complete');

  await ensurePuppeteerDependencies();

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    startScheduler();
  });

  // Graceful Shutdown Handler
  const shutdown = (signal) => {
    logger.warn(`Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await pool.destroy();
        logger.info('Database connections pool closed.');
        process.exit(0);
      } catch (err) {
        logger.error(`Error closing database pool: ${err.message}`);
        process.exit(1);
      }
    });

    // Force close after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();
