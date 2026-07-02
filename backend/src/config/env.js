const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

  // Renamed from the inconsistent FASTAPI_URL / FLASK_AI_URL split — one name now.
  ML_SERVICE_URL: z.string().url().default('http://localhost:8001'),
  ML_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  ML_RETRY_ATTEMPTS: z.coerce.number().int().min(0).default(2),
  ML_CIRCUIT_BREAKER_TIMEOUT_MS: z.coerce.number().int().positive().default(9000),
  ML_CIRCUIT_BREAKER_ERROR_THRESHOLD: z.coerce.number().int().positive().default(50),
  ML_CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(15000),

  REDIS_URL: z.string().optional(),
  REDIS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  CLIENT_URL: z.string().default('http://localhost:5173'),
  ALERT_COOLDOWN_MS: z.coerce.number().int().positive().default(300000),
  METRICS_EMIT_INTERVAL_MS: z.coerce.number().int().positive().default(2000),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  PREDICT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Fail fast and loud — this is a deploy-time error, not a runtime one.
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return parsed.data;
}

const env = loadEnv();

module.exports = env;
