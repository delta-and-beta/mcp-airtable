/**
 * Fetch utility with detailed error handling for debugging network issues
 */

import { logger } from "../logger.js";

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

/**
 * Wrap fetch with detailed error handling for debugging network issues
 */
export async function fetchWithDetails(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error: unknown) {
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
    logger.error("Fetch failed", { url, errorDetails });

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
