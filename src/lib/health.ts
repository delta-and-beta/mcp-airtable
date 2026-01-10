/**
 * Health check module for service monitoring
 * Provides liveness, readiness, and detailed health information
 */

import { getAllCircuitBreakerStats, CircuitState, type CircuitBreakerStats } from "./circuit-breaker.js";
import { getHttpAgentStats, type HttpAgentStats } from "./http-agent.js";
import { logger } from "./logger.js";

export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
}

export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  lastCheck?: number;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  uptime: number;
  version: string;
  components: {
    circuitBreakers: ComponentHealth;
    memory: ComponentHealth;
    httpAgent: ComponentHealth;
  };
  stats: {
    activeSessions: number;
    circuitBreakers: Map<string, CircuitBreakerStats>;
    memory: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
      external: number;
    };
    httpAgent: HttpAgentStats | null;
  };
}

export interface LivenessResult {
  status: "ok" | "error";
  timestamp: number;
}

export interface ReadinessResult {
  status: "ready" | "not_ready";
  timestamp: number;
  reason?: string;
}

// Server start time for uptime calculation
const startTime = Date.now();

/**
 * Calculate heap usage percentage
 */
function getHeapUsedPercent(memUsage: NodeJS.MemoryUsage): number {
  return (memUsage.heapUsed / memUsage.heapTotal) * 100;
}

// Active session count (updated by server)
let activeSessions = 0;

/**
 * Update active session count
 */
export function updateSessionCount(count: number): void {
  activeSessions = count;
}

/**
 * Increment active session count
 */
export function incrementSessions(): void {
  activeSessions++;
}

/**
 * Decrement active session count
 */
export function decrementSessions(): void {
  activeSessions = Math.max(0, activeSessions - 1);
}

/**
 * Get server uptime in milliseconds
 */
export function getUptime(): number {
  return Date.now() - startTime;
}

/**
 * Liveness probe - is the service alive?
 * Returns quickly, just confirms the service is running
 */
export function checkLiveness(): LivenessResult {
  return {
    status: "ok",
    timestamp: Date.now(),
  };
}

/**
 * Readiness probe - is the service ready to accept requests?
 * Checks if critical dependencies are available
 */
export function checkReadiness(): ReadinessResult {
  // Check circuit breakers - if Airtable circuit is open, we're not ready
  const circuitStats = getAllCircuitBreakerStats();
  const airtableBreaker = circuitStats.get("airtable-api");

  if (airtableBreaker && airtableBreaker.state === CircuitState.OPEN) {
    return {
      status: "not_ready",
      timestamp: Date.now(),
      reason: "Airtable API circuit breaker is open",
    };
  }

  // Check memory pressure
  const memUsage = process.memoryUsage();
  const heapUsedPercent = getHeapUsedPercent(memUsage);

  if (heapUsedPercent > 90) {
    return {
      status: "not_ready",
      timestamp: Date.now(),
      reason: `High memory pressure: ${heapUsedPercent.toFixed(1)}% heap used`,
    };
  }

  return {
    status: "ready",
    timestamp: Date.now(),
  };
}

/**
 * Detailed health check - full service health information
 */
export function checkHealth(version: string = "1.0.0"): HealthCheckResult {
  const circuitStats = getAllCircuitBreakerStats();
  const memUsage = process.memoryUsage();
  const httpAgentStats = getHttpAgentStats();

  // Evaluate circuit breaker health
  const circuitBreakerHealth = evaluateCircuitBreakerHealth(circuitStats);

  // Evaluate memory health
  const memoryHealth = evaluateMemoryHealth(memUsage);

  // Evaluate HTTP agent health
  const httpAgentHealth = evaluateHttpAgentHealth(httpAgentStats);

  // Overall status is the worst of all components
  const overallStatus = getWorstStatus([
    circuitBreakerHealth.status,
    memoryHealth.status,
    httpAgentHealth.status,
  ]);

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: Date.now(),
    uptime: getUptime(),
    version,
    components: {
      circuitBreakers: circuitBreakerHealth,
      memory: memoryHealth,
      httpAgent: httpAgentHealth,
    },
    stats: {
      activeSessions,
      circuitBreakers: circuitStats,
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
      },
      httpAgent: httpAgentStats,
    },
  };

  // Log if health is not healthy
  if (overallStatus !== HealthStatus.HEALTHY) {
    logger.warn("Health check returned non-healthy status", {
      status: overallStatus,
      circuitBreakers: circuitBreakerHealth.status,
      memory: memoryHealth.status,
      httpAgent: httpAgentHealth.status,
    });
  }

  return result;
}

/**
 * Evaluate health of circuit breakers
 */
function evaluateCircuitBreakerHealth(stats: Map<string, CircuitBreakerStats>): ComponentHealth {
  let openCount = 0;
  let halfOpenCount = 0;

  for (const [name, stat] of stats) {
    if (stat.state === CircuitState.OPEN) {
      openCount++;
    } else if (stat.state === CircuitState.HALF_OPEN) {
      halfOpenCount++;
    }
  }

  if (openCount > 0) {
    return {
      status: HealthStatus.UNHEALTHY,
      message: `${openCount} circuit breaker(s) open`,
      lastCheck: Date.now(),
      details: { openCount, halfOpenCount, totalBreakers: stats.size },
    };
  }

  if (halfOpenCount > 0) {
    return {
      status: HealthStatus.DEGRADED,
      message: `${halfOpenCount} circuit breaker(s) in half-open state`,
      lastCheck: Date.now(),
      details: { openCount, halfOpenCount, totalBreakers: stats.size },
    };
  }

  return {
    status: HealthStatus.HEALTHY,
    message: "All circuit breakers closed",
    lastCheck: Date.now(),
    details: { openCount, halfOpenCount, totalBreakers: stats.size },
  };
}

/**
 * Evaluate memory health
 */
function evaluateMemoryHealth(memUsage: NodeJS.MemoryUsage): ComponentHealth {
  const heapUsedPercent = getHeapUsedPercent(memUsage);
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

  if (heapUsedPercent > 90) {
    return {
      status: HealthStatus.UNHEALTHY,
      message: `High memory usage: ${heapUsedPercent.toFixed(1)}%`,
      lastCheck: Date.now(),
      details: { heapUsedMB, heapTotalMB, heapUsedPercent: heapUsedPercent.toFixed(1) },
    };
  }

  if (heapUsedPercent > 75) {
    return {
      status: HealthStatus.DEGRADED,
      message: `Elevated memory usage: ${heapUsedPercent.toFixed(1)}%`,
      lastCheck: Date.now(),
      details: { heapUsedMB, heapTotalMB, heapUsedPercent: heapUsedPercent.toFixed(1) },
    };
  }

  return {
    status: HealthStatus.HEALTHY,
    message: `Memory OK: ${heapUsedPercent.toFixed(1)}% used`,
    lastCheck: Date.now(),
    details: { heapUsedMB, heapTotalMB, heapUsedPercent: heapUsedPercent.toFixed(1) },
  };
}

/**
 * Evaluate HTTP agent health
 */
function evaluateHttpAgentHealth(stats: HttpAgentStats | null): ComponentHealth {
  if (!stats) {
    return {
      status: HealthStatus.HEALTHY,
      message: "HTTP agent not initialized",
      lastCheck: Date.now(),
      details: { initialized: false },
    };
  }

  // Check for connection pool issues
  const pendingRatio = stats.totalConnections > 0
    ? stats.pendingRequests / stats.totalConnections
    : 0;

  if (pendingRatio > 5) {
    return {
      status: HealthStatus.DEGRADED,
      message: `High pending request ratio: ${pendingRatio.toFixed(1)}`,
      lastCheck: Date.now(),
      details: { ...stats },
    };
  }

  return {
    status: HealthStatus.HEALTHY,
    message: `HTTP agent OK: ${stats.totalConnections} connections`,
    lastCheck: Date.now(),
    details: { ...stats },
  };
}

/**
 * Health status priority (higher = worse)
 */
const STATUS_PRIORITY: Record<HealthStatus, number> = {
  [HealthStatus.HEALTHY]: 0,
  [HealthStatus.DEGRADED]: 1,
  [HealthStatus.UNHEALTHY]: 2,
};

/**
 * Get the worst status from a list
 */
function getWorstStatus(statuses: HealthStatus[]): HealthStatus {
  return statuses.reduce((worst, status) =>
    STATUS_PRIORITY[status] > STATUS_PRIORITY[worst] ? status : worst,
    HealthStatus.HEALTHY
  );
}

/**
 * Format health check result as a human-readable string
 */
export function formatHealthResult(result: HealthCheckResult): string {
  const uptimeSeconds = Math.floor(result.uptime / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);

  const lines = [
    `Status: ${result.status.toUpperCase()}`,
    `Version: ${result.version}`,
    `Uptime: ${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
    "",
    "Components:",
    `  Circuit Breakers: ${result.components.circuitBreakers.status} - ${result.components.circuitBreakers.message}`,
    `  Memory: ${result.components.memory.status} - ${result.components.memory.message}`,
    `  HTTP Agent: ${result.components.httpAgent.status} - ${result.components.httpAgent.message}`,
    "",
    "Stats:",
    `  Active Sessions: ${result.stats.activeSessions}`,
    `  Heap Used: ${Math.round(result.stats.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(result.stats.memory.heapTotal / 1024 / 1024)}MB`,
  ];

  return lines.join("\n");
}
