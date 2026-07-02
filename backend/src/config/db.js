const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected to pool');
});

const SLOW_QUERY_THRESHOLD_MS = 200;

/** Drop-in replacement for pool.query(text, params) that logs slow queries. */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const durationMs = Date.now() - start;
    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn({ durationMs, text }, 'Slow query detected');
    }
    return result;
  } catch (err) {
    logger.error({ err: err.message, text }, 'Query failed');
    throw err;
  }
}

/**
 * Runs `fn` inside a single transaction. Commits on success, rolls back on
 * any thrown error, always releases the connection.
 *
 *   await withTransaction(async (client) => {
 *     await client.query('UPDATE ...');
 *     await client.query('INSERT ...');
 *   });
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function checkConnection() {
  const start = Date.now();
  await pool.query('SELECT 1');
  return Date.now() - start;
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, checkConnection, closePool };
