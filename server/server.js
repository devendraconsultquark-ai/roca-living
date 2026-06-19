import dotenv from "dotenv/config";
import { app } from "./app.js";
import logger from "./src/utils/logger.js";
import pool, { verifyDbConnection } from "./src/config/db.js";
const PORT = process.env.PORT || 9000;

// Verify DB first, then start server
const startServer = async () => {
  const dbConnected = await verifyDbConnection();
  if (!dbConnected && process.env.NODE_ENV === 'production') {
    logger.error("Database is not reachable. Exiting server...");
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`Server is running on http://localhost:${PORT}`);
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
