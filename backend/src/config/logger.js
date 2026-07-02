const pino = require('pino');
const env = require('./env');
const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'api-monitoring-backend', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
});

module.exports = logger;