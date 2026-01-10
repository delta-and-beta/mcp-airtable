/**
 * Fetch utility with detailed error handling and retry logic
 */

import { logger } from "../logger.js";
import { fetchWithRetry, isTimeoutError, type RetryOptions } from "../retry.js";

interface FetchErrorDetails {
  message: string;
  code?: string;
  errno?: number;
  syscall?: string;
  hostname?: string;
}

interface FetchErrorCause {
  code?: string;
  errno?: number;
  syscall?: string;
  hostname?: string;
}

export interface FetchOptions extends RequestInit {
  /** Retry options for transient failures */
  retry?: RetryOptions;
  /** Disable retry (useful for non-idempotent requests) */
  noRetry?: boolean;
  /** Timeout in milliseconds per request attempt (default: 30000) */
  timeoutMs?: number;
}

/**
 * Wrap fetch with detailed error handling and automatic retry for transient failures
 *
 * Features:
 * - Automatic retry with exponential backoff for 429, 500, 502, 503, 504 errors
 * - Respects Retry-After header for rate limits
 * - Retries on network errors (ECONNRESET, ETIMEDOUT, etc.)
 * - Detailed error logging for debugging
 */
export async function fetchWithDetails(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { retry, noRetry, timeoutMs, ...fetchOptions } = options;

  // Merge timeout into retry options
  const retryOptions: RetryOptions = {
    ...retry,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };

  try {
    // Use retry wrapper unless explicitly disabled
    if (noRetry) {
      return await fetch(url, fetchOptions);
    }

    return await fetchWithRetry(url, fetchOptions, retryOptions);
  } catch (error: unknown) {
    // Re-throw TimeoutError as-is (already has good message)
    if (isTimeoutError(error)) {
      logger.error("Fetch timed out", { url, timeoutMs: error.timeoutMs });
      throw error;
    }

    const err = error as Error & { cause?: FetchErrorCause };
    // Extract detailed error info for debugging
    const cause = err.cause;
    const errorDetails: FetchErrorDetails = {
      message: err.message,
      code: cause?.code,
      errno: cause?.errno,
      syscall: cause?.syscall,
      hostname: cause?.hostname,
    };
    logger.error("Fetch failed after retries", { url, errorDetails });

    // Provide more helpful error message
    let detailedMessage = err.message;
    if (cause?.code === "ENOTFOUND") {
      detailedMessage = `DNS lookup failed for ${cause.hostname || url}`;
    } else if (cause?.code === "ECONNREFUSED") {
      detailedMessage = `Connection refused to ${url}`;
    } else if (cause?.code === "CERT_HAS_EXPIRED" || cause?.code?.includes("CERT")) {
      detailedMessage = `TLS certificate error: ${cause.code}`;
    }

    throw new Error(`${detailedMessage} [${cause?.code || "UNKNOWN"}]`);
  }
}
