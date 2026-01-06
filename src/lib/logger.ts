/**
 * Structured logging utility
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const logLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
const isProduction = process.env.NODE_ENV === 'production';

function log(level: LogLevel, message: string, meta?: object) {
  if (levels[level] < levels[logLevel]) return;

  const timestamp = new Date().toISOString();

  if (isProduction) {
    console.log(JSON.stringify({ timestamp, level, message, ...meta }));
  } else {
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
    console.log('[' + timestamp + '] ' + level.toUpperCase() + ': ' + message + metaStr);
  }
}

export const logger = {
  debug: (message: string, meta?: object) => log('debug', message, meta),
  info: (message: string, meta?: object) => log('info', message, meta),
  warn: (message: string, meta?: object) => log('warn', message, meta),
  error: (message: string, meta?: object) => log('error', message, meta),
};
