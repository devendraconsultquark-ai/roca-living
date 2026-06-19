import knex from "knex";
import knexConfig from "../../knexfile.js";
import logger from "../utils/logger.js";

const environment = process.env.NODE_ENV || 'development';

const db = knex(knexConfig[environment]);

export const verifyDbConnection = async () => {

  try {
    await db.raw("SELECT 1");
    logger.info('Database connection established successfully via Knex!');
    return true;
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    return false;
  }
}

export default db;