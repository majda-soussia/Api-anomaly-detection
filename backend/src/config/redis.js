const Redis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

let client = null;

function init() {
  if (!env.REDIS_ENABLED || !env.REDIS_URL) {
    logger.info('Redis caching disabled (REDIS_ENABLED=false or REDIS_URL not set)');
    return null;
  }

  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    lazyConnect: true,
  });

  client.on('error', (err) => {
    // Log once per state change instead of spamming on every reconnect attempt.
    logger.warn({ err: err.message }, 'Redis error — falling back to direct DB reads');
  });

  client.on('connect', () => logger.info('Redis connected'));

  client.connect().catch((err) => {
    logger.warn({ err: err.message }, 'Redis initial connection failed — caching disabled for this run');
    client = null;
  });

  return client;
}

function isAvailable() {
  return !!client && client.status === 'ready';
}

async function get(key) {
  if (!isAvailable()) return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Redis GET failed');
    return null;
  }
}

async function set(key, value, ttlSeconds = 30) {
  if (!isAvailable()) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Redis SET failed');
  }
}

async function invalidate(pattern) {
  if (!isAvailable()) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length) await client.del(...keys);
  } catch (err) {
    logger.warn({ err: err.message, pattern }, 'Redis invalidate failed');
  }
}

async function close() {
  if (client) await client.quit();
}

module.exports = { init, isAvailable, get, set, invalidate, close };
