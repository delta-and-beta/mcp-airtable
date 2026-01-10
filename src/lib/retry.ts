/**
 * Retry utility with exponential backoff and jitter
 */

import { logger } from "./logger.js";
import { TimeoutError } from "./errors.js";
import { pooledFetch } from "./http-agent.js";

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Jitter factor 0-1 to randomize delays (default: 0.1) */
  jitterFactor?: number;
  /** HTTP status codes that should trigger retry (default: [429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
  /** Network error codes that should trigger retry */
  retryableErrorCodes?: string[];
  /** Timeout in milliseconds per request attempt (default: 30000) */
  timeoutMs?: number;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalDelayMs: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
  retryableStatuses: [429, 500, 502, 503, 504],
  retryableErrorCodes: ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE", "EAI_AGAIN"],
  timeoutMs: 30000,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoff(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number
): number {
  // Exponential backoff: initialDelay * 2^attempt
  const exponentialDelay = initialDelayMs * Math.pow(2, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter: delay * (1 - jitter + random * 2 * jitter)
  const jitter = (Math.random() * 2 - 1) * jitterFactor;
  const finalDelay = Math.round(cappedDelay * (1 + jitter));

  return Math.max(0, finalDelay);
}

/**
 * Check if an HTTP response status is retryable
 */
export function isRetryableStatus(status: number, retryableStatuses: number[]): boolean {
  return retryableStatuses.includes(status);
}

/**
 * Check if a network error code is retryable
 */
export function isRetryableError(errorCode: string | undefined, retryableCodes: string[]): boolean {
  if (!errorCode) return false;
  return retryableCodes.some(code => errorCode.includes(code));
}

/**
 * Extract Retry-After header value in milliseconds
 * Supports both seconds (integer) and HTTP-date formats
 */
export function parseRetryAfter(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) return null;

  const trimmed = retryAfterHeader.trim();
  if (trimmed === "") return null;

  // Try parsing as seconds (integer)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) * 1000;
  }

  // Try parsing as HTTP-date (RFC 7231 format)
  // HTTP-date is typically like "Wed, 21 Oct 2015 07:28:00 GMT"
  if (trimmed.includes(" ")) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }
  }

  return null;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let totalDelayMs = 0;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();

      if (attempt > 0) {
        logger.info("Retry succeeded", { attempt, totalDelayMs });
      }

      return { result, attempts: attempt + 1, totalDelayMs };
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const shouldRetry = attempt < opts.maxRetries && isRetryableNetworkError(error, opts.retryableErrorCodes);

      if (!shouldRetry) {
        throw error;
      }

      // Calculate delay
      const delay = calculateBackoff(attempt, opts.initialDelayMs, opts.maxDelayMs, opts.jitterFactor);
      totalDelayMs += delay;

      logger.warn("Retrying after error", {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        delayMs: delay,
        error: lastError.message,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Check if an error is a retryable network error
 */
function isRetryableNetworkError(error: unknown, retryableCodes: string[]): boolean {
  if (!(error instanceof Error)) return false;

  const err = error as Error & { cause?: { code?: string } };
  const code = err.cause?.code;

  return isRetryableError(code, retryableCodes);
}

/**
 * Execute fetch with timeout using AbortController
 * Each request attempt gets its own timeout
 * Uses pooled connections for better performance
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Use pooledFetch for connection reuse
    const response = await pooledFetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs, url);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if an error is a timeout error (retryable)
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Execute a fetch request with retry logic
 * Handles both network errors and HTTP error responses
 * Each retry attempt has its own timeout
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;
  let totalDelayMs = 0;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, opts.timeoutMs);

      // Check if response status is retryable
      if (isRetryableStatus(response.status, opts.retryableStatuses)) {
        lastResponse = response;

        if (attempt >= opts.maxRetries) {
          // No more retries, return the error response
          return response;
        }

        // Calculate delay - respect Retry-After header if present
        let delay: number;
        const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));

        if (retryAfter !== null && response.status === 429) {
          // Use Retry-After for rate limits, but cap at maxDelay
          delay = Math.min(retryAfter, opts.maxDelayMs);
        } else {
          delay = calculateBackoff(attempt, opts.initialDelayMs, opts.maxDelayMs, opts.jitterFactor);
        }

        totalDelayMs += delay;

        logger.warn("Retrying after HTTP error", {
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          status: response.status,
          delayMs: delay,
          retryAfterHeader: response.headers.get("Retry-After"),
        });

        await sleep(delay);
        continue;
      }

      // Success or non-retryable error
      if (attempt > 0) {
        logger.info("Fetch retry succeeded", { url, attempt, totalDelayMs });
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable (network error or timeout)
      const isNetworkRetryable = isRetryableNetworkError(error, opts.retryableErrorCodes);
      const isTimeout = isTimeoutError(error);
      const shouldRetry = attempt < opts.maxRetries && (isNetworkRetryable || isTimeout);

      if (!shouldRetry) {
        throw error;
      }

      const delay = calculateBackoff(attempt, opts.initialDelayMs, opts.maxDelayMs, opts.jitterFactor);
      totalDelayMs += delay;

      const errorType = isTimeout ? "timeout" : "network error";
      logger.warn(`Retrying after ${errorType}`, {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        delayMs: delay,
        error: lastError.message,
        timeoutMs: isTimeout ? opts.timeoutMs : undefined,
      });

      await sleep(delay);
    }
  }

  // If we have a response (from retryable status), return it
  if (lastResponse) {
    return lastResponse;
  }

  // Otherwise throw the last error
  throw lastError;
}
