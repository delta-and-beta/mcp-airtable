/**
 * Tests for request queue with concurrency control
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  RequestQueue,
  QueueFullError,
  QueueTimeoutError,
  getRequestQueue,
  closeRequestQueue,
  withQueue,
} from "../../lib/request-queue.js";

describe("request queue", () => {
  beforeEach(() => {
    closeRequestQueue();
    vi.useFakeTimers();
  });

  afterEach(() => {
    closeRequestQueue();
    vi.useRealTimers();
  });

  describe("RequestQueue", () => {
    describe("execute", () => {
      it("should execute function immediately when under concurrency limit", async () => {
        const queue = new RequestQueue({ maxConcurrency: 2 });
        const fn = vi.fn().mockResolvedValue("result");

        const result = await queue.execute(fn);

        expect(fn).toHaveBeenCalledOnce();
        expect(result).toBe("result");
      });

      it("should queue requests when at concurrency limit", async () => {
        const queue = new RequestQueue({ maxConcurrency: 1 });
        const results: string[] = [];

        let resolve1: () => void;
        const promise1 = new Promise<void>((r) => { resolve1 = r; });

        // Start first request (will be running)
        const result1Promise = queue.execute(async () => {
          await promise1;
          results.push("first");
          return "first";
        });

        // Second request should be queued
        const result2Promise = queue.execute(async () => {
          results.push("second");
          return "second";
        });

        // Verify first is running, second is queued
        const stats = queue.getStats();
        expect(stats.running).toBe(1);
        expect(stats.queued).toBe(1);

        // Complete first request
        resolve1!();
        await vi.runAllTimersAsync();

        const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

        expect(result1).toBe("first");
        expect(result2).toBe("second");
        expect(results).toEqual(["first", "second"]);
      });

      it("should process multiple concurrent requests up to limit", async () => {
        const queue = new RequestQueue({ maxConcurrency: 3 });
        const results: number[] = [];

        const promises = [1, 2, 3, 4, 5].map((n) =>
          queue.execute(async () => {
            results.push(n);
            return n;
          })
        );

        await vi.runAllTimersAsync();
        const values = await Promise.all(promises);

        expect(values).toEqual([1, 2, 3, 4, 5]);
        expect(queue.getStats().completed).toBe(5);
      });

      it("should throw QueueFullError when queue is full", async () => {
        const queue = new RequestQueue({
          maxConcurrency: 1,
          maxQueueSize: 2,
        });

        // Block the first request
        const blockingPromise = new Promise(() => {});
        queue.execute(() => blockingPromise);

        // Fill the queue
        queue.execute(() => Promise.resolve());
        queue.execute(() => Promise.resolve());

        // This should throw
        await expect(
          queue.execute(() => Promise.resolve())
        ).rejects.toThrow(QueueFullError);

        const stats = queue.getStats();
        expect(stats.rejected).toBe(1);
      });

      it("should timeout queued requests", async () => {
        const queue = new RequestQueue({
          maxConcurrency: 1,
          queueTimeoutMs: 1000,
        });

        // Block the first request
        let resolveFirst: () => void;
        const blockingPromise = new Promise<void>((r) => { resolveFirst = r; });
        const firstPromise = queue.execute(() => blockingPromise);

        // Queue a second request
        const secondPromise = queue.execute(() => Promise.resolve("second"));

        // Advance time past timeout
        vi.advanceTimersByTime(1500);

        await expect(secondPromise).rejects.toThrow(QueueTimeoutError);

        const stats = queue.getStats();
        expect(stats.timedOut).toBe(1);

        // Cleanup
        resolveFirst!();
        await firstPromise;
      });

      it("should propagate errors from executed functions", async () => {
        const queue = new RequestQueue();
        const error = new Error("Test error");

        await expect(
          queue.execute(() => Promise.reject(error))
        ).rejects.toThrow("Test error");
      });
    });

    describe("getStats", () => {
      it("should return accurate statistics", async () => {
        const queue = new RequestQueue({ maxConcurrency: 2 });

        let resolve1: () => void;
        const promise1 = new Promise<void>((r) => { resolve1 = r; });

        // Start requests
        const p1 = queue.execute(() => promise1);
        queue.execute(() => Promise.resolve());
        queue.execute(() => Promise.resolve());

        let stats = queue.getStats();
        expect(stats.maxConcurrency).toBe(2);
        expect(stats.running).toBe(2);
        expect(stats.queued).toBe(1);

        resolve1!();
        await vi.runAllTimersAsync();
        await p1;

        stats = queue.getStats();
        expect(stats.running).toBe(0);
        expect(stats.queued).toBe(0);
        expect(stats.completed).toBe(3);
      });
    });

    describe("clear", () => {
      it("should reject all queued requests", async () => {
        const queue = new RequestQueue({ maxConcurrency: 1 });

        // Block the first request
        const blockingPromise = new Promise(() => {});
        queue.execute(() => blockingPromise);

        // Queue some requests
        const p1 = queue.execute(() => Promise.resolve(1));
        const p2 = queue.execute(() => Promise.resolve(2));

        expect(queue.getStats().queued).toBe(2);

        // Clear the queue
        queue.clear();

        await expect(p1).rejects.toThrow("Queue cleared");
        await expect(p2).rejects.toThrow("Queue cleared");

        expect(queue.getStats().queued).toBe(0);
      });
    });

    describe("drain", () => {
      it("should wait for all requests to complete", async () => {
        const queue = new RequestQueue({ maxConcurrency: 2 });
        const results: number[] = [];

        // Start several requests
        for (let i = 0; i < 5; i++) {
          queue.execute(async () => {
            results.push(i);
            return i;
          });
        }

        await vi.runAllTimersAsync();
        await queue.drain();

        expect(results).toEqual([0, 1, 2, 3, 4]);
        expect(queue.getStats().running).toBe(0);
        expect(queue.getStats().queued).toBe(0);
      });

      it("should resolve immediately if queue is empty", async () => {
        const queue = new RequestQueue();
        await queue.drain(); // Should not hang
      });
    });

    describe("setConcurrency", () => {
      it("should update concurrency limit", () => {
        const queue = new RequestQueue({ maxConcurrency: 2 });
        expect(queue.getStats().maxConcurrency).toBe(2);

        queue.setConcurrency(5);
        expect(queue.getStats().maxConcurrency).toBe(5);
      });

      it("should throw for invalid concurrency", () => {
        const queue = new RequestQueue();
        expect(() => queue.setConcurrency(0)).toThrow();
        expect(() => queue.setConcurrency(-1)).toThrow();
      });

      it("should process queued requests when concurrency increases", async () => {
        const queue = new RequestQueue({ maxConcurrency: 1 });

        let resolveFirst: () => void;
        const blockingPromise = new Promise<void>((r) => { resolveFirst = r; });
        queue.execute(() => blockingPromise);

        // Queue additional requests
        const p1 = queue.execute(() => Promise.resolve(1));
        const p2 = queue.execute(() => Promise.resolve(2));

        expect(queue.getStats().queued).toBe(2);

        // Increase concurrency
        queue.setConcurrency(3);

        // Queued requests should start processing
        await vi.runAllTimersAsync();
        const results = await Promise.all([p1, p2]);

        expect(results).toEqual([1, 2]);

        resolveFirst!();
      });
    });
  });

  describe("global queue", () => {
    it("should create global queue on first access", () => {
      const queue = getRequestQueue();
      expect(queue).toBeInstanceOf(RequestQueue);
    });

    it("should return same instance on subsequent calls", () => {
      const queue1 = getRequestQueue();
      const queue2 = getRequestQueue();
      expect(queue1).toBe(queue2);
    });

    it("should create new instance after close", () => {
      const queue1 = getRequestQueue();
      closeRequestQueue();
      const queue2 = getRequestQueue();
      expect(queue1).not.toBe(queue2);
    });

    describe("withQueue", () => {
      it("should execute using global queue", async () => {
        const result = await withQueue(() => Promise.resolve("result"));
        expect(result).toBe("result");
      });

      it("should respect concurrency limits", async () => {
        // Initialize with low concurrency for testing
        closeRequestQueue();
        getRequestQueue({ maxConcurrency: 1 });

        let running = 0;
        let maxRunning = 0;

        const promises = [1, 2, 3].map((n) =>
          withQueue(async () => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await new Promise((r) => setTimeout(r, 10));
            running--;
            return n;
          })
        );

        await vi.runAllTimersAsync();
        await Promise.all(promises);

        expect(maxRunning).toBe(1);
      });
    });
  });

  describe("QueueFullError", () => {
    it("should include queue size information", () => {
      const error = new QueueFullError("Queue full", 10, 10);
      expect(error.name).toBe("QueueFullError");
      expect(error.queueSize).toBe(10);
      expect(error.maxQueueSize).toBe(10);
    });
  });

  describe("QueueTimeoutError", () => {
    it("should include timing information", () => {
      const error = new QueueTimeoutError("Timed out", 5000, 30000);
      expect(error.name).toBe("QueueTimeoutError");
      expect(error.waitTimeMs).toBe(5000);
      expect(error.timeoutMs).toBe(30000);
    });
  });
});
