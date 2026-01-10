/**
 * Unit tests for health check module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkLiveness,
  checkReadiness,
  checkHealth,
  formatHealthResult,
  getUptime,
  updateSessionCount,
  incrementSessions,
  decrementSessions,
  HealthStatus,
} from "../../lib/health.js";
import {
  getCircuitBreaker,
  clearAllCircuitBreakers,
  CircuitState,
} from "../../lib/circuit-breaker.js";

describe("health module", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllCircuitBreakers();
    updateSessionCount(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkLiveness", () => {
    it("should return ok status", () => {
      const result = checkLiveness();
      expect(result.status).toBe("ok");
      expect(result.timestamp).toBeDefined();
    });
  });

  describe("checkReadiness", () => {
    it("should return ready when no circuit breakers are open", () => {
      const result = checkReadiness();
      expect(result.status).toBe("ready");
      expect(result.timestamp).toBeDefined();
      expect(result.reason).toBeUndefined();
    });

    it("should return not_ready when airtable circuit breaker is open", () => {
      const breaker = getCircuitBreaker("airtable-api", { failureThreshold: 1 });
      breaker.recordFailure();

      const result = checkReadiness();
      expect(result.status).toBe("not_ready");
      expect(result.reason).toContain("circuit breaker is open");
    });
  });

  describe("checkHealth", () => {
    it("should return healthy status when all components are healthy", () => {
      const result = checkHealth("1.0.0");

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.version).toBe("1.0.0");
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should include component health details", () => {
      const result = checkHealth();

      expect(result.components.circuitBreakers).toBeDefined();
      expect(result.components.circuitBreakers.status).toBeDefined();
      expect(result.components.circuitBreakers.message).toBeDefined();

      expect(result.components.memory).toBeDefined();
      expect(result.components.memory.status).toBeDefined();
      expect(result.components.memory.message).toBeDefined();
    });

    it("should include stats", () => {
      const result = checkHealth();

      expect(result.stats.activeSessions).toBe(0);
      expect(result.stats.circuitBreakers).toBeDefined();
      expect(result.stats.memory).toBeDefined();
      expect(result.stats.memory.heapUsed).toBeGreaterThan(0);
      expect(result.stats.memory.heapTotal).toBeGreaterThan(0);
    });

    it("should return unhealthy when circuit breaker is open", () => {
      const breaker = getCircuitBreaker("test-service", { failureThreshold: 1 });
      breaker.recordFailure();

      const result = checkHealth();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.components.circuitBreakers.status).toBe(HealthStatus.UNHEALTHY);
    });

    it("should return degraded when circuit breaker is half-open", () => {
      const breaker = getCircuitBreaker("test-service", {
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      });
      breaker.recordFailure();

      // Advance time to trigger half-open
      vi.advanceTimersByTime(1500);
      breaker.getState(); // Trigger state check

      const result = checkHealth();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.components.circuitBreakers.status).toBe(HealthStatus.DEGRADED);
    });
  });

  describe("session tracking", () => {
    it("should track active sessions", () => {
      updateSessionCount(5);
      const result = checkHealth();
      expect(result.stats.activeSessions).toBe(5);
    });

    it("should increment session count", () => {
      incrementSessions();
      incrementSessions();
      const result = checkHealth();
      expect(result.stats.activeSessions).toBe(2);
    });

    it("should decrement session count", () => {
      updateSessionCount(5);
      decrementSessions();
      decrementSessions();
      const result = checkHealth();
      expect(result.stats.activeSessions).toBe(3);
    });

    it("should not go below zero", () => {
      updateSessionCount(0);
      decrementSessions();
      const result = checkHealth();
      expect(result.stats.activeSessions).toBe(0);
    });
  });

  describe("getUptime", () => {
    it("should return uptime in milliseconds", () => {
      const uptime = getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    it("should increase over time", () => {
      const uptime1 = getUptime();
      vi.advanceTimersByTime(1000);
      const uptime2 = getUptime();
      expect(uptime2).toBeGreaterThan(uptime1);
    });
  });

  describe("formatHealthResult", () => {
    it("should format health result as human-readable string", () => {
      const result = checkHealth("1.0.0");
      const formatted = formatHealthResult(result);

      expect(formatted).toContain("Status:");
      expect(formatted).toContain("Version: 1.0.0");
      expect(formatted).toContain("Uptime:");
      expect(formatted).toContain("Components:");
      expect(formatted).toContain("Circuit Breakers:");
      expect(formatted).toContain("Memory:");
      expect(formatted).toContain("Stats:");
    });
  });
});
