import dotenv from 'dotenv';
dotenv.config();

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
export default {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
    pool: { min: 2, max: Number(process.env.DB_POOL_MAX) || 10 },
    acquireConnectionTimeout: 30000,
    migrations: {
      directory: './src/db/migrations',
      tableName: 'knex_migrations',
    },
  },
  production: {
    client: "mysql2",
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
    pool: { min: 2, max: Number(process.env.DB_POOL_MAX) || 20 },
    acquireConnectionTimeout: 30000,
    migrations: {
      directory: './src/db/migrations',
      tableName: 'knex_migrations',
    },
  },
};
