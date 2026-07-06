
const axios = require('axios');
const axiosRetry = require('axios-retry').default || require('axios-retry');
const CircuitBreaker = require('opossum');
const env = require('../config/env');
const logger = require('../config/logger');

const client = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: env.ML_REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(client, {
  retries: env.ML_RETRY_ATTEMPTS,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) ||
    (error.response && error.response.status >= 500) ||
    error.code === 'ECONNABORTED',
});

async function rawPredict(features) {
  const { data } = await client.post('/predict', features);
  return data;
}

const breaker = new CircuitBreaker(rawPredict, {
  timeout: env.ML_CIRCUIT_BREAKER_TIMEOUT_MS,
  errorThresholdPercentage: env.ML_CIRCUIT_BREAKER_ERROR_THRESHOLD,
  resetTimeout: env.ML_CIRCUIT_BREAKER_RESET_MS,
  rollingCountTimeout: 10000,
  name: 'ml-predict',
});

breaker.on('open', () => logger.warn('Circuit breaker OPEN — ML service unhealthy, failing fast'));
breaker.on('halfOpen', () => logger.info('Circuit breaker HALF-OPEN — testing ML service recovery'));
breaker.on('close', () => logger.info('Circuit breaker CLOSED — ML service recovered'));
breaker.fallback(() => {
  const err = new Error('ML service unavailable (circuit open)');
  err.code = 'EOPENBREAKER';
  throw err;
});

async function predict(features) {
  return breaker.fire(features);
}

async function checkHealth() {
  const start = Date.now();
  try {
    const { data, status } = await client.get('/health', { timeout: 3000 });
    return { status: status === 200 ? 'up' : 'degraded', latencyMs: Date.now() - start, detail: data };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - start, error: err.message };
  }
}

function getCircuitState() {
  return breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed';
}

module.exports = { predict, checkHealth, getCircuitState };
