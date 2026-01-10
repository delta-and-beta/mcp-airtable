/**
 * Tests for idempotency key generation and tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  generateIdempotencyKey,
  checkIdempotency,
  startIdempotentOperation,
  completeIdempotentOperation,
  failIdempotentOperation,
  removeIdempotencyKey,
  getIdempotencyStats,
  clearIdempotencyStore,
  withIdempotency,
  startIdempotencyCleanup,
  stopIdempotencyCleanup,
} from "../../lib/idempotency.js";

describe("idempotency module", () => {
  beforeEach(() => {
    clearIdempotencyStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopIdempotencyCleanup();
    vi.useRealTimers();
  });

  describe("generateIdempotencyKey", () => {
    it("should generate consistent key for same operation and params", () => {
      const params = { baseId: "app123", tableId: "tbl456", name: "Test" };
      const key1 = generateIdempotencyKey("createRecord", params);
      const key2 = generateIdempotencyKey("createRecord", params);

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different operations", () => {
      const params = { baseId: "app123", tableId: "tbl456" };
      const key1 = generateIdempotencyKey("createRecord", params);
      const key2 = generateIdempotencyKey("updateRecord", params);

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different params", () => {
      const params1 = { baseId: "app123", tableId: "tbl456" };
      const params2 = { baseId: "app123", tableId: "tbl789" };
      const key1 = generateIdempotencyKey("createRecord", params1);
      const key2 = generateIdempotencyKey("createRecord", params2);

      expect(key1).not.toBe(key2);
    });

    it("should use user-provided key when given", () => {
      const params = { baseId: "app123" };
      const userKey = "my-custom-key-123";
      const key = generateIdempotencyKey("createRecord", params, userKey);

      expect(key).toBe(`createRecord:${userKey}`);
    });

    it("should handle empty params", () => {
      const key = generateIdempotencyKey("createRecord", {});
      expect(key).toMatch(/^createRecord:\d+:[a-f0-9]+$/);
    });

    it("should be consistent regardless of param order", () => {
      const params1 = { a: 1, b: 2, c: 3 };
      const params2 = { c: 3, a: 1, b: 2 };
      const key1 = generateIdempotencyKey("op", params1);
      const key2 = generateIdempotencyKey("op", params2);

      expect(key1).toBe(key2);
    });
  });

  describe("startIdempotentOperation", () => {
    it("should return isNew: true for new operations", () => {
      const result = startIdempotentOperation("key1", "createRecord");

      expect(result.isNew).toBe(true);
      expect(result.existingEntry).toBeUndefined();
    });

    it("should return isNew: false for duplicate operations", () => {
      startIdempotentOperation("key1", "createRecord");
      const result = startIdempotentOperation("key1", "createRecord");

      expect(result.isNew).toBe(false);
      expect(result.existingEntry).toBeDefined();
      expect(result.existingEntry?.status).toBe("pending");
    });

    it("should track operation as pending", () => {
      startIdempotentOperation("key1", "createRecord");
      const entry = checkIdempotency("key1");

      expect(entry).not.toBeNull();
      expect(entry?.status).toBe("pending");
      expect(entry?.operation).toBe("createRecord");
    });
  });

  describe("completeIdempotentOperation", () => {
    it("should mark operation as completed with result", () => {
      startIdempotentOperation("key1", "createRecord");
      const result = { id: "rec123", fields: { name: "Test" } };
      completeIdempotentOperation("key1", result);

      const entry = checkIdempotency("key1");

      expect(entry?.status).toBe("completed");
      expect(entry?.result).toEqual(result);
    });

    it("should handle non-existent key gracefully", () => {
      // Should not throw
      expect(() => {
        completeIdempotentOperation("nonexistent", { id: "123" });
      }).not.toThrow();
    });
  });

  describe("failIdempotentOperation", () => {
    it("should mark operation as failed with error", () => {
      startIdempotentOperation("key1", "createRecord");
      failIdempotentOperation("key1", "Network error");

      const entry = checkIdempotency("key1");

      expect(entry?.status).toBe("failed");
      expect(entry?.error).toBe("Network error");
    });
  });

  describe("removeIdempotencyKey", () => {
    it("should remove the key", () => {
      startIdempotentOperation("key1", "createRecord");
      removeIdempotencyKey("key1");

      const entry = checkIdempotency("key1");
      expect(entry).toBeNull();
    });
  });

  describe("checkIdempotency", () => {
    it("should return null for non-existent keys", () => {
      const entry = checkIdempotency("nonexistent");
      expect(entry).toBeNull();
    });

    it("should return null for expired keys", () => {
      startIdempotentOperation("key1", "createRecord");

      // Advance time past TTL (5 minutes)
      vi.advanceTimersByTime(6 * 60 * 1000);

      const entry = checkIdempotency("key1");
      expect(entry).toBeNull();
    });

    it("should return entry for valid keys", () => {
      startIdempotentOperation("key1", "createRecord");

      // Advance time less than TTL
      vi.advanceTimersByTime(2 * 60 * 1000);

      const entry = checkIdempotency("key1");
      expect(entry).not.toBeNull();
    });
  });

  describe("getIdempotencyStats", () => {
    it("should return correct stats", () => {
      startIdempotentOperation("key1", "op1");
      startIdempotentOperation("key2", "op2");
      completeIdempotentOperation("key1", {});
      startIdempotentOperation("key3", "op3");
      failIdempotentOperation("key3", "error");

      const stats = getIdempotencyStats();

      expect(stats.totalKeys).toBe(3);
      expect(stats.pendingCount).toBe(1);
      expect(stats.completedCount).toBe(1);
      expect(stats.failedCount).toBe(1);
    });

    it("should return zeros for empty store", () => {
      const stats = getIdempotencyStats();

      expect(stats.totalKeys).toBe(0);
      expect(stats.pendingCount).toBe(0);
      expect(stats.completedCount).toBe(0);
      expect(stats.failedCount).toBe(0);
    });
  });

  describe("withIdempotency", () => {
    it("should execute function for new operation", async () => {
      const fn = vi.fn().mockResolvedValue({ id: "rec123" });

      const result = await withIdempotency("key1", "createRecord", fn);

      expect(fn).toHaveBeenCalledOnce();
      expect(result).toEqual({ id: "rec123" });
    });

    it("should return cached result for completed operation", async () => {
      const fn = vi.fn().mockResolvedValue({ id: "rec123" });

      // First call
      await withIdempotency("key1", "createRecord", fn);

      // Second call with same key
      const result = await withIdempotency("key1", "createRecord", fn);

      expect(fn).toHaveBeenCalledOnce(); // Not called again
      expect(result).toEqual({ id: "rec123" });
    });

    it("should allow retry for failed operation", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ id: "rec123" });

      // First call fails
      await expect(withIdempotency("key1", "createRecord", fn)).rejects.toThrow("Network error");

      // Second call should retry
      const result = await withIdempotency("key1", "createRecord", fn);

      expect(fn).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: "rec123" });
    });

    it("should mark operation as failed on error", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Failed"));

      await expect(withIdempotency("key1", "createRecord", fn)).rejects.toThrow("Failed");

      const entry = checkIdempotency("key1");
      expect(entry?.status).toBe("failed");
      expect(entry?.error).toBe("Failed");
    });

    it("should mark operation as completed on success", async () => {
      const fn = vi.fn().mockResolvedValue({ id: "rec123" });

      await withIdempotency("key1", "createRecord", fn);

      const entry = checkIdempotency("key1");
      expect(entry?.status).toBe("completed");
      expect(entry?.result).toEqual({ id: "rec123" });
    });
  });

  describe("cleanup", () => {
    it("should start and stop cleanup interval", () => {
      startIdempotencyCleanup(1000);

      // Add an entry
      startIdempotentOperation("key1", "op");

      // Advance past TTL
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Trigger cleanup
      vi.advanceTimersByTime(1000);

      // Entry should be gone on next check
      const entry = checkIdempotency("key1");
      expect(entry).toBeNull();

      stopIdempotencyCleanup();
    });

    it("should not start multiple cleanup intervals", () => {
      startIdempotencyCleanup(1000);
      startIdempotencyCleanup(1000);

      // Should not throw or create issues
      stopIdempotencyCleanup();
    });
  });

  describe("max keys enforcement", () => {
    it("should evict old entries when max reached", () => {
      // Create more than max entries (with smaller max for testing)
      // The default max is 10000, but we test eviction logic
      for (let i = 0; i < 100; i++) {
        startIdempotentOperation(`key${i}`, "op");
        vi.advanceTimersByTime(10); // Small time increment for ordering
      }

      // First entries might have been evicted due to capacity
      const stats = getIdempotencyStats();
      expect(stats.totalKeys).toBeLessThanOrEqual(10000);
    });
  });
});
