const pino = require('pino');

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = pino({
  level: LOG_LEVEL,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'feedplug-backend',
    env: process.env.NODE_ENV || 'development',
  },
  mixin() {
    return {
      timestamp: new Date().toISOString(),
    };
  },
});

const createChildLogger = (context) => {
  return logger.child(context);
};

module.exports = {
  logger,
  createChildLogger,
  trace: (...args) => logger.trace(...args),
  debug: (...args) => logger.debug(...args),
  info: (...args) => logger.info(...args),
  warn: (...args) => logger.warn(...args),
  error: (...args) => logger.error(...args),
  fatal: (...args) => logger.fatal(...args),
};
