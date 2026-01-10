/**
 * Request deduplication for preventing duplicate concurrent requests
 * When identical requests are made concurrently, shares the result instead of making multiple API calls
 */

import { createHash } from "crypto";
import { logger } from "./logger.js";

export interface DeduplicationOptions {
  /** Time-to-live for pending requests in milliseconds (default: 30 seconds) */
  ttlMs?: number;
  /** Maximum number of pending requests to track (default: 1000) */
  maxPending?: number;
}

export interface DeduplicationStats {
  pendingRequests: number;
  dedupedRequests: number;
  totalRequests: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  createdAt: number;
  subscribers: number;
}

const DEFAULT_OPTIONS: Required<DeduplicationOptions> = {
  ttlMs: 30000, // 30 seconds
  maxPending: 1000,
};

// Pending requests map
const pendingRequests = new Map<string, PendingRequest<unknown>>();

// Stats tracking
let dedupedCount = 0;
let totalCount = 0;

/**
 * Generate a unique key for a request based on its parameters
 */
export function generateRequestKey(
  method: string,
  url: string,
  body?: unknown
): string {
  const bodyHash = body
    ? createHash("sha256")
        .update(JSON.stringify(body))
        .digest("hex")
        .substring(0, 16)
    : "no-body";

  return `${method}:${url}:${bodyHash}`;
}

/**
 * Check if a pending request is still valid (not expired)
 */
function isValidPendingRequest(pending: PendingRequest<unknown>): boolean {
  return Date.now() - pending.createdAt <= DEFAULT_OPTIONS.ttlMs;
}

/**
 * Check if a request with this key is already pending
 */
export function isPending(key: string): boolean {
  const pending = pendingRequests.get(key);
  if (!pending || !isValidPendingRequest(pending)) {
    if (pending) pendingRequests.delete(key);
    return false;
  }
  return true;
}

/**
 * Get the pending request promise if one exists
 */
export function getPendingRequest<T>(key: string): Promise<T> | null {
  const pending = pendingRequests.get(key) as PendingRequest<T> | undefined;
  if (!pending || !isValidPendingRequest(pending)) {
    if (pending) pendingRequests.delete(key);
    return null;
  }

  pending.subscribers++;
  dedupedCount++;

  logger.debug("Request deduplicated", {
    key,
    subscribers: pending.subscribers,
  });

  return pending.promise;
}

/**
 * Register a new pending request
 */
function registerPendingRequest<T>(key: string, promise: Promise<T>): void {
  // Enforce max pending limit
  if (pendingRequests.size >= DEFAULT_OPTIONS.maxPending) {
    // Remove oldest entry
    const oldest = Array.from(pendingRequests.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) {
      pendingRequests.delete(oldest[0]);
      logger.debug("Evicted oldest pending request", { key: oldest[0] });
    }
  }

  pendingRequests.set(key, {
    promise,
    createdAt: Date.now(),
    subscribers: 1,
  });

  totalCount++;

  // Clean up when promise settles
  // Use void to suppress unhandled rejection warnings - subscribers will handle errors
  void promise
    .catch(() => {}) // Suppress unhandled rejection
    .finally(() => {
      pendingRequests.delete(key);
    });
}

/**
 * Execute a function with request deduplication
 * If an identical request is already in flight, returns the existing promise
 */
export async function withDeduplication<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Check for existing pending request
  const existing = getPendingRequest<T>(key);
  if (existing) {
    return existing;
  }

  // Execute and register the new request
  const promise = fn();
  registerPendingRequest(key, promise);

  return promise;
}

/**
 * Execute a fetch request with automatic deduplication
 */
export async function fetchWithDeduplication(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method || "GET";
  const key = generateRequestKey(method, url, options.body);

  // Only deduplicate safe methods (GET, HEAD, OPTIONS)
  const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());

  if (!safeMethod) {
    // For non-safe methods, execute immediately without deduplication
    totalCount++;
    return fetch(url, options);
  }

  return withDeduplication(key, () => fetch(url, options));
}

/**
 * Get deduplication statistics
 */
export function getDeduplicationStats(): DeduplicationStats {
  return {
    pendingRequests: pendingRequests.size,
    dedupedRequests: dedupedCount,
    totalRequests: totalCount,
  };
}

/**
 * Clear all pending requests (for testing)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Reset stats counters (for testing)
 */
export function resetDeduplicationStats(): void {
  dedupedCount = 0;
  totalCount = 0;
}

/**
 * Clean up expired pending requests
 */
export function cleanupExpiredRequests(): number {
  let cleaned = 0;

  for (const [key, pending] of pendingRequests.entries()) {
    if (!isValidPendingRequest(pending)) {
      pendingRequests.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug("Cleaned up expired pending requests", { cleaned });
  }

  return cleaned;
}

// Cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic cleanup of expired requests
 */
export function startDeduplicationCleanup(intervalMs: number = 10000): void {
  if (cleanupInterval) {
    return;
  }

  cleanupInterval = setInterval(cleanupExpiredRequests, intervalMs);
  cleanupInterval.unref(); // Don't prevent process exit

  logger.debug("Started deduplication cleanup", { intervalMs });
}

/**
 * Stop periodic cleanup
 */
export function stopDeduplicationCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.debug("Stopped deduplication cleanup");
  }
}
