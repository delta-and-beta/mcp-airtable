/**
 * Unit tests for circuit breaker pattern
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerError,
  getCircuitBreaker,
  resetAllCircuitBreakers,
  clearAllCircuitBreakers,
  getAllCircuitBreakerStats,
} from "../../lib/circuit-breaker.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllCircuitBreakers(); // Clear registry for fresh breakers each test
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should start in CLOSED state", () => {
      const breaker = new CircuitBreaker();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should allow requests in CLOSED state", () => {
      const breaker = new CircuitBreaker();
      expect(breaker.canRequest()).toBe(true);
    });

    it("should have zero stats initially", () => {
      const breaker = new CircuitBreaker();
      const stats = breaker.getStats();
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.lastFailureTime).toBeNull();
      expect(stats.lastSuccessTime).toBeNull();
    });
  });

  describe("recording success", () => {
    it("should track success count", () => {
      const breaker = new CircuitBreaker();
      breaker.recordSuccess();
      breaker.recordSuccess();

      const stats = breaker.getStats();
      expect(stats.successes).toBe(2);
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalRequests).toBe(2);
    });

    it("should update lastSuccessTime", () => {
      const breaker = new CircuitBreaker();
      const now = Date.now();
      breaker.recordSuccess();

      const stats = breaker.getStats();
      expect(stats.lastSuccessTime).toBe(now);
    });

    it("should reset failure count on success in CLOSED state", () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5 });

      // Record some failures (but not enough to open)
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getStats().failures).toBe(2);

      // Success should reset failures
      breaker.recordSuccess();
      expect(breaker.getStats().failures).toBe(0);
    });
  });

  describe("recording failure", () => {
    it("should track failure count", () => {
      const breaker = new CircuitBreaker();
      breaker.recordFailure();
      breaker.recordFailure();

      const stats = breaker.getStats();
      expect(stats.failures).toBe(2);
      expect(stats.totalFailures).toBe(2);
    });

    it("should update lastFailureTime", () => {
      const breaker = new CircuitBreaker();
      const now = Date.now();
      breaker.recordFailure();

      const stats = breaker.getStats();
      expect(stats.lastFailureTime).toBe(now);
    });

    it("should open circuit after threshold failures", () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it("should reject requests when circuit is open", () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });

      breaker.recordFailure();
      breaker.recordFailure();

      expect(() => breaker.canRequest()).toThrow(CircuitBreakerError);
    });
  });

  describe("state transitions", () => {
    it("should transition to HALF_OPEN after reset timeout", () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
      });

      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Advance time past reset timeout
      vi.advanceTimersByTime(1500);

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it("should close circuit after success threshold in HALF_OPEN", () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        successThreshold: 2,
      });

      // Open then half-open
      breaker.recordFailure();
      breaker.recordFailure();
      vi.advanceTimersByTime(1500);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Record successes
      breaker.recordSuccess();
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      breaker.recordSuccess();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should reopen circuit on failure in HALF_OPEN", () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
      });

      // Open then half-open
      breaker.recordFailure();
      breaker.recordFailure();
      vi.advanceTimersByTime(1500);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Failure should reopen
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe("failure window", () => {
    it("should only count failures within window", () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        failureWindowMs: 5000,
      });

      // Record 2 failures
      breaker.recordFailure();
      breaker.recordFailure();

      // Advance past window
      vi.advanceTimersByTime(6000);

      // These old failures should be pruned
      // Add one more failure - should still be CLOSED (only 1 in window)
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // Add 2 more to reach threshold
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe("execute", () => {
    it("should execute function and record success", async () => {
      const breaker = new CircuitBreaker();
      const fn = vi.fn().mockResolvedValue("result");

      const result = await breaker.execute(fn);

      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(breaker.getStats().successes).toBe(1);
    });

    it("should execute function and record failure on error", async () => {
      const breaker = new CircuitBreaker();
      const error = new Error("Test error");
      const fn = vi.fn().mockRejectedValue(error);

      await expect(breaker.execute(fn)).rejects.toThrow("Test error");
      expect(breaker.getStats().failures).toBe(1);
    });

    it("should not execute function when circuit is open", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const fn = vi.fn().mockResolvedValue("result");

      breaker.recordFailure();
      breaker.recordFailure();

      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerError);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("should reset to CLOSED state", () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().failures).toBe(0);
    });
  });

  describe("forceState", () => {
    it("should force circuit to specified state", () => {
      const breaker = new CircuitBreaker();

      breaker.forceState(CircuitState.OPEN);
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.forceState(CircuitState.HALF_OPEN);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      breaker.forceState(CircuitState.CLOSED);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe("CircuitBreakerError", () => {
    it("should include circuit name and next retry time", () => {
      const breaker = new CircuitBreaker({
        name: "test-service",
        failureThreshold: 1,
        resetTimeoutMs: 5000,
      });

      breaker.recordFailure();

      try {
        breaker.canRequest();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError);
        const cbError = error as CircuitBreakerError;
        expect(cbError.circuitName).toBe("test-service");
        expect(cbError.nextRetryTime).toBeGreaterThan(Date.now());
      }
    });
  });

  describe("global registry", () => {
    it("should get or create named circuit breaker", () => {
      const breaker1 = getCircuitBreaker("service-a");
      const breaker2 = getCircuitBreaker("service-a");

      expect(breaker1).toBe(breaker2);
    });

    it("should create different breakers for different names", () => {
      const breaker1 = getCircuitBreaker("service-a");
      const breaker2 = getCircuitBreaker("service-b");

      expect(breaker1).not.toBe(breaker2);
    });

    it("should reset all circuit breakers", () => {
      const breaker1 = getCircuitBreaker("service-a", { failureThreshold: 1 });
      const breaker2 = getCircuitBreaker("service-b", { failureThreshold: 1 });

      breaker1.recordFailure();
      breaker2.recordFailure();

      expect(breaker1.getState()).toBe(CircuitState.OPEN);
      expect(breaker2.getState()).toBe(CircuitState.OPEN);

      resetAllCircuitBreakers();

      expect(breaker1.getState()).toBe(CircuitState.CLOSED);
      expect(breaker2.getState()).toBe(CircuitState.CLOSED);
    });

    it("should get stats for all circuit breakers", () => {
      const breaker1 = getCircuitBreaker("service-a");
      const breaker2 = getCircuitBreaker("service-b");

      breaker1.recordSuccess();
      breaker2.recordFailure();

      const allStats = getAllCircuitBreakerStats();

      expect(allStats.get("service-a")?.successes).toBe(1);
      expect(allStats.get("service-b")?.failures).toBe(1);
    });
  });
});
