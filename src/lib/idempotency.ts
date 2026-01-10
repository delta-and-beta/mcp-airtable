/**
 * Idempotency key generation and tracking for safe retries
 * Generates unique keys for write operations to prevent duplicate writes
 */

import { createHash } from "crypto";
import { logger } from "./logger.js";

export interface IdempotencyOptions {
  /** Time-to-live for idempotency keys in milliseconds (default: 5 minutes) */
  ttlMs?: number;
  /** Maximum number of keys to track (default: 10000) */
  maxKeys?: number;
}

export interface IdempotencyEntry {
  key: string;
  createdAt: number;
  operation: string;
  status: "pending" | "completed" | "failed";
  result?: unknown;
  error?: string;
}

const DEFAULT_OPTIONS: Required<IdempotencyOptions> = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxKeys: 10000,
};

// In-memory storage for idempotency tracking
const idempotencyStore = new Map<string, IdempotencyEntry>();

// Cleanup interval reference
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Generate a unique idempotency key for an operation
 * Key is based on operation type and a hash of the parameters
 */
export function generateIdempotencyKey(
  operation: string,
  params: Record<string, unknown>,
  userProvidedKey?: string
): string {
  // If user provides their own key, use it with operation prefix
  if (userProvidedKey) {
    return `${operation}:${userProvidedKey}`;
  }

  // Generate key from operation and params hash
  const paramsString = JSON.stringify(params, Object.keys(params).sort());
  const hash = createHash("sha256")
    .update(paramsString)
    .digest("hex")
    .substring(0, 16);

  // Include timestamp component for uniqueness (hourly bucket)
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));

  return `${operation}:${hourBucket}:${hash}`;
}

/**
 * Check if an operation with this key is already pending or completed
 * Returns the existing entry if found and still valid
 */
export function checkIdempotency(key: string): IdempotencyEntry | null {
  const entry = idempotencyStore.get(key);

  if (!entry) {
    return null;
  }

  // Check if entry has expired
  const now = Date.now();
  if (now - entry.createdAt > DEFAULT_OPTIONS.ttlMs) {
    idempotencyStore.delete(key);
    return null;
  }

  return entry;
}

/**
 * Start tracking an operation with idempotency key
 * Returns true if this is a new operation, false if duplicate
 */
export function startIdempotentOperation(
  key: string,
  operation: string
): { isNew: boolean; existingEntry?: IdempotencyEntry } {
  const existing = checkIdempotency(key);

  if (existing) {
    logger.debug("Idempotent operation already exists", {
      key,
      operation,
      status: existing.status,
    });
    return { isNew: false, existingEntry: existing };
  }

  // Enforce max keys limit (evict oldest entries)
  enforceMaxKeys();

  const entry: IdempotencyEntry = {
    key,
    createdAt: Date.now(),
    operation,
    status: "pending",
  };

  idempotencyStore.set(key, entry);

  logger.debug("Started idempotent operation", { key, operation });

  return { isNew: true };
}

/**
 * Mark an operation as completed with its result
 */
export function completeIdempotentOperation(
  key: string,
  result: unknown
): void {
  const entry = idempotencyStore.get(key);

  if (entry) {
    entry.status = "completed";
    entry.result = result;
    logger.debug("Completed idempotent operation", { key, operation: entry.operation });
  }
}

/**
 * Mark an operation as failed with error
 */
export function failIdempotentOperation(
  key: string,
  error: string
): void {
  const entry = idempotencyStore.get(key);

  if (entry) {
    entry.status = "failed";
    entry.error = error;
    logger.debug("Failed idempotent operation", { key, operation: entry.operation, error });
  }
}

/**
 * Remove an idempotency key (for cleanup after permanent failure)
 */
export function removeIdempotencyKey(key: string): void {
  idempotencyStore.delete(key);
}

/**
 * Get current stats about idempotency tracking
 */
export function getIdempotencyStats(): {
  totalKeys: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
} {
  let pending = 0;
  let completed = 0;
  let failed = 0;

  for (const entry of idempotencyStore.values()) {
    switch (entry.status) {
      case "pending":
        pending++;
        break;
      case "completed":
        completed++;
        break;
      case "failed":
        failed++;
        break;
    }
  }

  return {
    totalKeys: idempotencyStore.size,
    pendingCount: pending,
    completedCount: completed,
    failedCount: failed,
  };
}

/**
 * Enforce maximum key limit by evicting oldest entries
 */
function enforceMaxKeys(): void {
  if (idempotencyStore.size < DEFAULT_OPTIONS.maxKeys) {
    return;
  }

  // Find and remove oldest entries
  const entries = Array.from(idempotencyStore.entries())
    .sort((a, b) => a[1].createdAt - b[1].createdAt);

  // Remove oldest 10% to avoid frequent eviction
  const removeCount = Math.ceil(DEFAULT_OPTIONS.maxKeys * 0.1);

  for (let i = 0; i < removeCount && i < entries.length; i++) {
    idempotencyStore.delete(entries[i][0]);
  }

  logger.debug("Evicted old idempotency keys", { removedCount: removeCount });
}

/**
 * Clean up expired entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, entry] of idempotencyStore.entries()) {
    if (now - entry.createdAt > DEFAULT_OPTIONS.ttlMs) {
      idempotencyStore.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.debug("Cleaned up expired idempotency keys", { cleanedCount });
  }
}

/**
 * Start periodic cleanup of expired entries
 */
export function startIdempotencyCleanup(intervalMs: number = 60000): void {
  if (cleanupInterval) {
    return;
  }

  cleanupInterval = setInterval(cleanupExpiredEntries, intervalMs);
  cleanupInterval.unref(); // Don't prevent process exit

  logger.debug("Started idempotency cleanup", { intervalMs });
}

/**
 * Stop periodic cleanup
 */
export function stopIdempotencyCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.debug("Stopped idempotency cleanup");
  }
}

/**
 * Clear all idempotency entries (for testing)
 */
export function clearIdempotencyStore(): void {
  idempotencyStore.clear();
}

/**
 * Higher-order function that wraps an async operation with idempotency tracking
 */
export async function withIdempotency<T>(
  key: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const { isNew, existingEntry } = startIdempotentOperation(key, operation);

  // If operation already exists and completed, return cached result
  if (!isNew && existingEntry) {
    if (existingEntry.status === "completed") {
      logger.info("Returning cached result for idempotent operation", { key, operation });
      return existingEntry.result as T;
    }

    if (existingEntry.status === "pending") {
      // Another request is in progress - this is a race condition
      // In a distributed system, we'd need distributed locks
      // For now, we'll let both proceed but log a warning
      logger.warn("Concurrent idempotent operation detected", { key, operation });
    }

    // If failed, allow retry
    if (existingEntry.status === "failed") {
      logger.info("Retrying previously failed idempotent operation", { key, operation });
      // Remove the failed entry to allow fresh tracking
      removeIdempotencyKey(key);
      startIdempotentOperation(key, operation);
    }
  }

  try {
    const result = await fn();
    completeIdempotentOperation(key, result);
    return result;
  } catch (error) {
    failIdempotentOperation(key, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
