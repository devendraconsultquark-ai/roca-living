import knex from "knex";
import knexConfig from "../../knexfile.js";
import logger from "../utils/logger.js";

const environment = process.env.NODE_ENV || 'development';

const db = knex(knexConfig[environment]);

// Secondary Knex pool for rocaem (roca_dev_db)
export const emDb = knex({
  client: 'mysql2',
  connection: {
    host: process.env.ROCAEM_DB_HOST,
    port: Number(process.env.ROCAEM_DB_PORT),
    database: process.env.ROCAEM_DB_NAME,
    user: process.env.ROCAEM_DB_USER,
    password: process.env.ROCAEM_DB_PASSWORD,
  }
});

export const verifyDbConnection = async () => {
  try {
    await db.raw("SELECT 1");
    logger.info('Database connection established successfully via Knex!');
    
    // Check connection to rocaem
    try {
      await emDb.raw("SELECT 1");
      logger.info('rocaem database connection established successfully via Knex!');
    } catch (emErr) {
      logger.warn(`rocaem database connection failed: ${emErr.message}`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    return false;
  }
}

export default db;