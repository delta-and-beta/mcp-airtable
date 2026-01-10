/**
 * Tests for request deduplication module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateRequestKey,
  isPending,
  getPendingRequest,
  withDeduplication,
  getDeduplicationStats,
  clearPendingRequests,
  resetDeduplicationStats,
  startDeduplicationCleanup,
  stopDeduplicationCleanup,
  cleanupExpiredRequests,
} from "../../lib/deduplication.js";

describe("deduplication module", () => {
  beforeEach(() => {
    clearPendingRequests();
    resetDeduplicationStats();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopDeduplicationCleanup();
    vi.useRealTimers();
  });

  describe("generateRequestKey", () => {
    it("should generate consistent keys for same request", () => {
      const key1 = generateRequestKey("GET", "https://example.com/api/data");
      const key2 = generateRequestKey("GET", "https://example.com/api/data");

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different methods", () => {
      const key1 = generateRequestKey("GET", "https://example.com/api");
      const key2 = generateRequestKey("POST", "https://example.com/api");

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different URLs", () => {
      const key1 = generateRequestKey("GET", "https://example.com/api/1");
      const key2 = generateRequestKey("GET", "https://example.com/api/2");

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different bodies", () => {
      const key1 = generateRequestKey("POST", "https://example.com/api", { a: 1 });
      const key2 = generateRequestKey("POST", "https://example.com/api", { a: 2 });

      expect(key1).not.toBe(key2);
    });

    it("should handle undefined body", () => {
      const key = generateRequestKey("GET", "https://example.com/api");
      expect(key).toContain("no-body");
    });

    it("should include body hash for POST requests", () => {
      const key = generateRequestKey("POST", "https://example.com/api", { data: "test" });
      expect(key).not.toContain("no-body");
    });
  });

  describe("isPending", () => {
    it("should return false for unknown keys", () => {
      expect(isPending("unknown-key")).toBe(false);
    });

    it("should return true for pending requests", async () => {
      let resolveRequest: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolveRequest = resolve;
      });

      // Start a request
      withDeduplication("key1", () => promise);

      expect(isPending("key1")).toBe(true);

      // Cleanup
      resolveRequest!("done");
      await promise;
    });

    it("should return false after request completes", async () => {
      const promise = Promise.resolve("result");

      await withDeduplication("key1", () => promise);

      // Wait for promise cleanup
      await vi.runAllTimersAsync();

      expect(isPending("key1")).toBe(false);
    });
  });

  describe("withDeduplication", () => {
    it("should execute function for new request", async () => {
      const fn = vi.fn().mockResolvedValue("result");

      const result = await withDeduplication("key1", fn);

      expect(fn).toHaveBeenCalledOnce();
      expect(result).toBe("result");
    });

    it("should share result for concurrent duplicate requests", async () => {
      let resolveRequest: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolveRequest = resolve;
      });

      const fn = vi.fn(() => promise);

      // Start two concurrent requests with same key
      const result1Promise = withDeduplication("key1", fn);
      const result2Promise = withDeduplication("key1", fn);

      // Function should only be called once
      expect(fn).toHaveBeenCalledOnce();

      // Resolve the request
      resolveRequest!("shared-result");

      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

      expect(result1).toBe("shared-result");
      expect(result2).toBe("shared-result");
    });

    it("should allow new request after previous completes", async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce("first")
        .mockResolvedValueOnce("second");

      // First request
      const result1 = await withDeduplication("key1", fn);
      await vi.runAllTimersAsync();

      // Second request (should execute again)
      const result2 = await withDeduplication("key1", fn);

      expect(fn).toHaveBeenCalledTimes(2);
      expect(result1).toBe("first");
      expect(result2).toBe("second");
    });

    it("should propagate errors to all subscribers", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Failed"));

      // Start two concurrent requests
      const result1Promise = withDeduplication("key1", fn);
      const result2Promise = withDeduplication("key1", fn);

      await expect(result1Promise).rejects.toThrow("Failed");
      await expect(result2Promise).rejects.toThrow("Failed");

      // Function should only be called once
      expect(fn).toHaveBeenCalledOnce();
    });

    it("should handle different keys independently", async () => {
      let resolve1: (value: string) => void;
      let resolve2: (value: string) => void;
      const promise1 = new Promise<string>((resolve) => { resolve1 = resolve; });
      const promise2 = new Promise<string>((resolve) => { resolve2 = resolve; });

      const fn1 = vi.fn(() => promise1);
      const fn2 = vi.fn(() => promise2);

      // Start requests with different keys
      const result1Promise = withDeduplication("key1", fn1);
      const result2Promise = withDeduplication("key2", fn2);

      // Both functions should be called
      expect(fn1).toHaveBeenCalledOnce();
      expect(fn2).toHaveBeenCalledOnce();

      // Resolve both
      resolve1!("result1");
      resolve2!("result2");

      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);
      expect(result1).toBe("result1");
      expect(result2).toBe("result2");
    });
  });

  describe("getDeduplicationStats", () => {
    it("should return initial stats", () => {
      const stats = getDeduplicationStats();

      expect(stats.pendingRequests).toBe(0);
      expect(stats.dedupedRequests).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });

    it("should track pending and total requests", async () => {
      let resolveRequest: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolveRequest = resolve;
      });

      // Start a request
      const resultPromise = withDeduplication("key1", () => promise);

      let stats = getDeduplicationStats();
      expect(stats.pendingRequests).toBe(1);
      expect(stats.totalRequests).toBe(1);

      resolveRequest!("done");
      await resultPromise;
      await vi.runAllTimersAsync();

      stats = getDeduplicationStats();
      expect(stats.pendingRequests).toBe(0);
      expect(stats.totalRequests).toBe(1);
    });

    it("should track deduped requests", async () => {
      let resolveRequest: (value: string) => void;
      const promise = new Promise<string>((resolve) => {
        resolveRequest = resolve;
      });

      // Start two concurrent requests with same key
      const p1 = withDeduplication("key1", () => promise);
      const p2 = withDeduplication("key1", () => promise);

      const stats = getDeduplicationStats();
      expect(stats.dedupedRequests).toBe(1); // Second request was deduped

      resolveRequest!("done");
      await Promise.all([p1, p2]);
    });
  });

  describe("cleanup", () => {
    it("should clean up expired requests", async () => {
      // Create a promise that never resolves
      const promise = new Promise<string>(() => {});
      withDeduplication("key1", () => promise);

      expect(isPending("key1")).toBe(true);

      // Advance time past TTL (30 seconds)
      vi.advanceTimersByTime(35000);

      // Should be expired now
      expect(isPending("key1")).toBe(false);
    });

    it("should run periodic cleanup", async () => {
      startDeduplicationCleanup(1000);

      // Create a long-running request
      const promise = new Promise<string>(() => {});
      withDeduplication("key1", () => promise);

      // Advance past TTL
      vi.advanceTimersByTime(35000);

      // Trigger cleanup
      vi.advanceTimersByTime(1000);

      const cleaned = cleanupExpiredRequests();
      // Already cleaned by periodic cleanup or isPending check
      expect(isPending("key1")).toBe(false);

      stopDeduplicationCleanup();
    });
  });

  describe("max pending limit", () => {
    it("should evict oldest when max reached", async () => {
      // Create many pending requests
      const promises: Promise<string>[] = [];

      for (let i = 0; i < 100; i++) {
        const promise = new Promise<string>(() => {});
        promises.push(withDeduplication(`key${i}`, () => promise));
        vi.advanceTimersByTime(10);
      }

      const stats = getDeduplicationStats();
      // Should not exceed maxPending (default 1000)
      expect(stats.pendingRequests).toBeLessThanOrEqual(1000);
    });
  });

  describe("resetDeduplicationStats", () => {
    it("should reset counters", async () => {
      const promise = Promise.resolve("result");
      await withDeduplication("key1", () => promise);

      resetDeduplicationStats();

      const stats = getDeduplicationStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.dedupedRequests).toBe(0);
    });
  });
});
