/**
 * Unit tests for retry utility with exponential backoff
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateBackoff,
  isRetryableStatus,
  isRetryableError,
  parseRetryAfter,
  withRetry,
  fetchWithRetry,
  isTimeoutError,
} from "../../lib/retry.js";
import { TimeoutError } from "../../lib/errors.js";

describe("retry utility", () => {
  describe("calculateBackoff", () => {
    it("should calculate exponential backoff correctly", () => {
      const initialDelay = 1000;
      const maxDelay = 30000;
      const jitter = 0; // No jitter for predictable tests

      expect(calculateBackoff(0, initialDelay, maxDelay, jitter)).toBe(1000); // 1000 * 2^0
      expect(calculateBackoff(1, initialDelay, maxDelay, jitter)).toBe(2000); // 1000 * 2^1
      expect(calculateBackoff(2, initialDelay, maxDelay, jitter)).toBe(4000); // 1000 * 2^2
      expect(calculateBackoff(3, initialDelay, maxDelay, jitter)).toBe(8000); // 1000 * 2^3
    });

    it("should cap delay at maxDelay", () => {
      const initialDelay = 1000;
      const maxDelay = 5000;
      const jitter = 0;

      expect(calculateBackoff(0, initialDelay, maxDelay, jitter)).toBe(1000);
      expect(calculateBackoff(5, initialDelay, maxDelay, jitter)).toBe(5000); // Would be 32000, capped
      expect(calculateBackoff(10, initialDelay, maxDelay, jitter)).toBe(5000); // Stays capped
    });

    it("should apply jitter within expected range", () => {
      const initialDelay = 1000;
      const maxDelay = 30000;
      const jitter = 0.1; // 10% jitter

      // Run multiple times to check jitter variance
      const results = new Set<number>();
      for (let i = 0; i < 20; i++) {
        results.add(calculateBackoff(0, initialDelay, maxDelay, jitter));
      }

      // With jitter, we should get varying results
      // Base delay is 1000, with 10% jitter: 900-1100
      results.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(900);
        expect(delay).toBeLessThanOrEqual(1100);
      });
    });

    it("should handle zero jitter", () => {
      const delay = calculateBackoff(0, 1000, 30000, 0);
      expect(delay).toBe(1000);
    });
  });

  describe("isRetryableStatus", () => {
    const retryableStatuses = [429, 500, 502, 503, 504];

    it("should return true for retryable statuses", () => {
      expect(isRetryableStatus(429, retryableStatuses)).toBe(true);
      expect(isRetryableStatus(500, retryableStatuses)).toBe(true);
      expect(isRetryableStatus(502, retryableStatuses)).toBe(true);
      expect(isRetryableStatus(503, retryableStatuses)).toBe(true);
      expect(isRetryableStatus(504, retryableStatuses)).toBe(true);
    });

    it("should return false for non-retryable statuses", () => {
      expect(isRetryableStatus(200, retryableStatuses)).toBe(false);
      expect(isRetryableStatus(400, retryableStatuses)).toBe(false);
      expect(isRetryableStatus(401, retryableStatuses)).toBe(false);
      expect(isRetryableStatus(403, retryableStatuses)).toBe(false);
      expect(isRetryableStatus(404, retryableStatuses)).toBe(false);
      expect(isRetryableStatus(422, retryableStatuses)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    const retryableCodes = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"];

    it("should return true for retryable error codes", () => {
      expect(isRetryableError("ECONNRESET", retryableCodes)).toBe(true);
      expect(isRetryableError("ETIMEDOUT", retryableCodes)).toBe(true);
      expect(isRetryableError("ECONNREFUSED", retryableCodes)).toBe(true);
    });

    it("should return false for non-retryable error codes", () => {
      expect(isRetryableError("ENOTFOUND", retryableCodes)).toBe(false);
      expect(isRetryableError("EPERM", retryableCodes)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isRetryableError(undefined, retryableCodes)).toBe(false);
    });

    it("should handle partial matches", () => {
      expect(isRetryableError("Some_ECONNRESET_error", retryableCodes)).toBe(true);
    });
  });

  describe("parseRetryAfter", () => {
    it("should parse integer seconds", () => {
      expect(parseRetryAfter("60")).toBe(60000);
      expect(parseRetryAfter("1")).toBe(1000);
      expect(parseRetryAfter("0")).toBe(0);
    });

    it("should parse HTTP-date format", () => {
      const futureDate = new Date(Date.now() + 5000).toUTCString();
      const result = parseRetryAfter(futureDate);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(6000); // Allow some tolerance
    });

    it("should return null for invalid values", () => {
      expect(parseRetryAfter(null)).toBe(null);
      expect(parseRetryAfter("")).toBe(null);
      expect(parseRetryAfter("invalid")).toBe(null);
      expect(parseRetryAfter("-1")).toBe(null);
    });

    it("should handle past dates", () => {
      const pastDate = new Date(Date.now() - 5000).toUTCString();
      const result = parseRetryAfter(pastDate);
      expect(result).toBe(0);
    });
  });

  describe("withRetry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return result on first success", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const promise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(1);
      expect(result.totalDelayMs).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable network error", async () => {
      const retryableError = new Error("Connection reset");
      (retryableError as any).cause = { code: "ECONNRESET" };

      const fn = vi
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue("success");

      const promise = withRetry(fn, { maxRetries: 2, initialDelayMs: 100, jitterFactor: 0 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.result).toBe("success");
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should not retry on non-retryable error", async () => {
      const error = new Error("Not found");
      (error as any).cause = { code: "ENOTFOUND" };

      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow("Not found");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should exhaust retries and throw last error", async () => {
      const error = new Error("Connection reset");
      (error as any).cause = { code: "ECONNRESET" };

      const fn = vi.fn().mockRejectedValue(error);

      // Start the retry operation
      let caughtError: Error | null = null;
      const promise = withRetry(fn, { maxRetries: 2, initialDelayMs: 100, jitterFactor: 0 })
        .catch(e => { caughtError = e; });

      // Run all timers to exhaust retries
      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe("Connection reset");
      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
  });

  describe("fetchWithRetry", () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.useFakeTimers();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.resetAllMocks();
    });

    it("should return response on success", async () => {
      const response = new Response("OK", { status: 200 });
      mockFetch.mockResolvedValue(response);

      const result = await fetchWithRetry("https://example.com", {});

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry on 429 rate limit", async () => {
      const rateLimitResponse = new Response("Rate limited", { status: 429 });
      const successResponse = new Response("OK", { status: 200 });

      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValue(successResponse);

      const promise = fetchWithRetry("https://example.com", {}, {
        maxRetries: 2,
        initialDelayMs: 100,
        jitterFactor: 0,
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on 500 server error", async () => {
      const serverErrorResponse = new Response("Server error", { status: 500 });
      const successResponse = new Response("OK", { status: 200 });

      mockFetch
        .mockResolvedValueOnce(serverErrorResponse)
        .mockResolvedValue(successResponse);

      const promise = fetchWithRetry("https://example.com", {}, {
        maxRetries: 2,
        initialDelayMs: 100,
        jitterFactor: 0,
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry on 400 client error", async () => {
      const clientErrorResponse = new Response("Bad request", { status: 400 });
      mockFetch.mockResolvedValue(clientErrorResponse);

      const result = await fetchWithRetry("https://example.com", {});

      expect(result.status).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should respect Retry-After header for 429", async () => {
      const headers = new Headers({ "Retry-After": "2" });
      const rateLimitResponse = new Response("Rate limited", { status: 429, headers });
      const successResponse = new Response("OK", { status: 200 });

      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValue(successResponse);

      const promise = fetchWithRetry("https://example.com", {}, {
        maxRetries: 2,
        initialDelayMs: 100,
        jitterFactor: 0,
      });

      // Should wait for Retry-After (2000ms) not initialDelay (100ms)
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should return error response after exhausting retries", async () => {
      const serverErrorResponse = new Response("Server error", { status: 503 });
      mockFetch.mockResolvedValue(serverErrorResponse);

      const promise = fetchWithRetry("https://example.com", {}, {
        maxRetries: 2,
        initialDelayMs: 100,
        jitterFactor: 0,
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.status).toBe(503);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("should retry on network error", async () => {
      const networkError = new Error("Connection reset");
      (networkError as any).cause = { code: "ECONNRESET" };
      const successResponse = new Response("OK", { status: 200 });

      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue(successResponse);

      const promise = fetchWithRetry("https://example.com", {}, {
        maxRetries: 2,
        initialDelayMs: 100,
        jitterFactor: 0,
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw TimeoutError when request times out", async () => {
      // Simulate a slow fetch that respects abort signal
      mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
        return new Promise((resolve, reject) => {
          const checkAbort = () => {
            if (opts?.signal?.aborted) {
              const abortError = new Error("The operation was aborted");
              abortError.name = "AbortError";
              reject(abortError);
              return true;
            }
            return false;
          };

          if (!checkAbort()) {
            // Check periodically for abort
            const intervalId = setInterval(() => {
              if (checkAbort()) {
                clearInterval(intervalId);
              }
            }, 10);
          }
        });
      });

      let caughtError: Error | null = null;
      const promise = fetchWithRetry("https://example.com", {}, {
        timeoutMs: 100,
        maxRetries: 0, // No retries to test single timeout
      }).catch(e => { caughtError = e; });

      await vi.advanceTimersByTimeAsync(150);
      await promise;

      expect(caughtError).not.toBeNull();
      expect(caughtError).toBeInstanceOf(TimeoutError);
      expect(caughtError!.message).toContain("Request timed out");
      const timeoutErr = caughtError as unknown as TimeoutError;
      expect(timeoutErr.timeoutMs).toBe(100);
      expect(timeoutErr.url).toBe("https://example.com");
    });

    it("should retry on timeout error", async () => {
      // First request times out, second succeeds
      const successResponse = new Response("OK", { status: 200 });
      let callCount = 0;

      mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          // First call - simulate timeout (abort-aware)
          return new Promise((resolve, reject) => {
            const checkAbort = () => {
              if (opts?.signal?.aborted) {
                const abortError = new Error("The operation was aborted");
                abortError.name = "AbortError";
                reject(abortError);
                return true;
              }
              return false;
            };

            if (!checkAbort()) {
              const intervalId = setInterval(() => {
                if (checkAbort()) {
                  clearInterval(intervalId);
                }
              }, 10);
            }
          });
        }
        // Second call - success
        return Promise.resolve(successResponse);
      });

      const promise = fetchWithRetry("https://example.com", {}, {
        timeoutMs: 100,
        maxRetries: 2,
        initialDelayMs: 50,
        jitterFactor: 0,
      });

      // Advance past first timeout (100ms) + backoff delay (50ms) + some buffer
      await vi.advanceTimersByTimeAsync(300);
      const result = await promise;

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should exhaust retries on repeated timeouts", async () => {
      // All requests time out
      mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
        return new Promise((resolve, reject) => {
          const checkAbort = () => {
            if (opts?.signal?.aborted) {
              const abortError = new Error("The operation was aborted");
              abortError.name = "AbortError";
              reject(abortError);
              return true;
            }
            return false;
          };

          if (!checkAbort()) {
            const intervalId = setInterval(() => {
              if (checkAbort()) {
                clearInterval(intervalId);
              }
            }, 10);
          }
        });
      });

      let caughtError: Error | null = null;
      const promise = fetchWithRetry("https://example.com", {}, {
        timeoutMs: 100,
        maxRetries: 2,
        initialDelayMs: 50,
        jitterFactor: 0,
      }).catch(e => { caughtError = e; });

      // Need to advance through 3 timeouts (initial + 2 retries) with delays
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(caughtError).not.toBeNull();
      expect(caughtError).toBeInstanceOf(TimeoutError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("should use custom timeout value", async () => {
      mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
        return new Promise((resolve, reject) => {
          const checkAbort = () => {
            if (opts?.signal?.aborted) {
              const abortError = new Error("The operation was aborted");
              abortError.name = "AbortError";
              reject(abortError);
              return true;
            }
            return false;
          };

          if (!checkAbort()) {
            const intervalId = setInterval(() => {
              if (checkAbort()) {
                clearInterval(intervalId);
              }
            }, 10);
          }
        });
      });

      let caughtError: Error | null = null;
      const promise = fetchWithRetry("https://example.com", {}, {
        timeoutMs: 5000, // 5 second custom timeout
        maxRetries: 0,
      }).catch(e => { caughtError = e; });

      // Should not timeout at 4 seconds
      await vi.advanceTimersByTimeAsync(4000);
      expect(caughtError).toBeNull();

      // Should timeout at 5 seconds
      await vi.advanceTimersByTimeAsync(1500);
      await promise;

      expect(caughtError).not.toBeNull();
      expect(caughtError).toBeInstanceOf(TimeoutError);
    });
  });

  describe("isTimeoutError", () => {
    it("should return true for TimeoutError", () => {
      const error = new TimeoutError("Request timed out", 5000, "https://example.com");
      expect(isTimeoutError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Some error");
      expect(isTimeoutError(error)).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
    });

    it("should return false for non-Error objects", () => {
      expect(isTimeoutError({ message: "fake error" })).toBe(false);
      expect(isTimeoutError("error string")).toBe(false);
    });
  });
});
