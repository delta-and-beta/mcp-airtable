/**
 * Structured logging utility
 *
 * IMPORTANT: For MCP stdio transport, logs MUST go to stderr only.
 * stdout is reserved exclusively for JSON-RPC protocol messages.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const logLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
const isProduction = process.env.NODE_ENV === 'production';

// Check if running in stdio mode - logs must go to stderr
const isStdioMode = process.argv.includes('--stdio');

function log(level: LogLevel, message: string, meta?: object) {
  if (levels[level] < levels[logLevel]) return;

  // In stdio mode, suppress non-error logs to avoid protocol interference
  // Only errors go to stderr in stdio mode
  if (isStdioMode && level !== 'error') return;

  const timestamp = new Date().toISOString();
  const output = isProduction
    ? JSON.stringify({ timestamp, level, message, ...meta })
    : '[' + timestamp + '] ' + level.toUpperCase() + ': ' + message + (meta ? ' ' + JSON.stringify(meta) : '');

  // Always use stderr for MCP compatibility
  // stdout is reserved for JSON-RPC messages in stdio transport
  console.error(output);
}

export const logger = {
  debug: (message: string, meta?: object) => log('debug', message, meta),
  info: (message: string, meta?: object) => log('info', message, meta),
  warn: (message: string, meta?: object) => log('warn', message, meta),
  error: (message: string, meta?: object) => log('error', message, meta),
};
