import { logger } from './logger.js';
import { RateLimitError } from './errors.js';

/**
 * Options for retry with exponential backoff
 */
interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Context for logging */
  context?: Record<string, unknown>;
}

/**
 * Check if an error is a rate limit error (429)
 */
function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as Record<string, unknown>;

  // Check various error formats
  if (err.statusCode === 429 || err.status === 429) return true;
  if (typeof err.message === 'string' && err.message.includes('RATE_LIMIT')) return true;
  if (typeof err.message === 'string' && err.message.includes('429')) return true;
  if (typeof err.code === 'string' && err.code === 'RATE_LIMIT_EXCEEDED') return true;

  return false;
}

/**
 * Extract Retry-After value from error headers (in seconds)
 */
function extractRetryAfter(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;

  const err = error as Record<string, unknown>;

  // Check for headers object
  if (err.headers && typeof err.headers === 'object') {
    const headers = err.headers as Record<string, unknown>;
    const retryAfter = headers['retry-after'] || headers['Retry-After'];
    if (typeof retryAfter === 'string') {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed)) return parsed;
    }
    if (typeof retryAfter === 'number') return retryAfter;
  }

  // Check for response.headers (fetch-style)
  if (err.response && typeof err.response === 'object') {
    const response = err.response as Record<string, unknown>;
    if (response.headers && typeof response.headers === 'object') {
      const headers = response.headers as { get?: (key: string) => string | null };
      if (typeof headers.get === 'function') {
        const retryAfter = headers.get('Retry-After');
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
  }

  return null;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay; // Add randomness to prevent thundering herd
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Execute a function with automatic retry on rate limit (429) errors.
 * Uses exponential backoff with jitter, and respects Retry-After headers.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise with the function result
 * @throws Original error if max retries exceeded or non-rate-limit error
 *
 * @example
 * const result = await withRetryOnRateLimit(
 *   () => airtableClient.getRecords('Tasks'),
 *   { maxRetries: 3, context: { operation: 'getRecords' } }
 * );
 */
export async function withRetryOnRateLimit<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    context = {},
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Only retry on rate limit errors
      if (!isRateLimitError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        logger.warn('Rate limit: max retries exceeded', {
          ...context,
          attempts: attempt + 1,
        });
        throw error;
      }

      // Calculate delay (prefer Retry-After header if available)
      const retryAfter = extractRetryAfter(error);
      const delay = retryAfter !== null
        ? retryAfter * 1000 // Retry-After is in seconds
        : calculateDelay(attempt, baseDelay, maxDelay);

      logger.warn('Rate limited, retrying after delay', {
        ...context,
        attempt: attempt + 1,
        maxRetries,
        delayMs: delay,
        retryAfterHeader: retryAfter !== null,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should not be reached, but TypeScript requires it
  throw lastError || new RateLimitError('Max retries exceeded');
}

/**
 * Create a retry wrapper with pre-configured options.
 * Useful for creating consistent retry behavior across multiple operations.
 *
 * @param defaultOptions - Default retry options
 * @returns Configured retry function
 *
 * @example
 * const retryWithDefaults = createRetryWrapper({ maxRetries: 5 });
 * const result = await retryWithDefaults(() => fetchData());
 */
export function createRetryWrapper(defaultOptions: RetryOptions = {}) {
  return function <T>(
    fn: () => Promise<T>,
    overrideOptions: RetryOptions = {}
  ): Promise<T> {
    return withRetryOnRateLimit(fn, { ...defaultOptions, ...overrideOptions });
  };
}
