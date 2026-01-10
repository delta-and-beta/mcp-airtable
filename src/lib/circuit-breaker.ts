/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by failing fast when a service is unhealthy
 */

import { logger } from "./logger.js";

export enum CircuitState {
  CLOSED = "CLOSED",     // Normal operation, requests pass through
  OPEN = "OPEN",         // Service failing, requests rejected immediately
  HALF_OPEN = "HALF_OPEN" // Testing recovery, limited requests allowed
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting recovery (default: 30000) */
  resetTimeoutMs?: number;
  /** Number of successful requests in half-open to close circuit (default: 2) */
  successThreshold?: number;
  /** Time window in ms to count failures (default: 60000) */
  failureWindowMs?: number;
  /** Optional name for logging */
  name?: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreakerError extends Error {
  public code: string = "CIRCUIT_OPEN";

  constructor(
    message: string = "Circuit breaker is open",
    public circuitName?: string,
    public nextRetryTime?: number
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, "name">> & { name: string } = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  successThreshold: 2,
  failureWindowMs: 60000,
  name: "default",
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private lastStateChange: number = Date.now();
  private failureTimestamps: number[] = [];

  // Lifetime stats
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;

  private readonly options: Required<Omit<CircuitBreakerOptions, "name">> & { name: string };

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get the current state of the circuit breaker
   */
  getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  /**
   * Get statistics about the circuit breaker
   */
  getStats(): CircuitBreakerStats {
    this.checkStateTransition();
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Check if a request is allowed
   * Throws CircuitBreakerError if circuit is open
   */
  canRequest(): boolean {
    this.checkStateTransition();

    if (this.state === CircuitState.OPEN) {
      const nextRetryTime = this.lastStateChange + this.options.resetTimeoutMs;
      const retryInSeconds = Math.ceil((nextRetryTime - Date.now()) / 1000);

      throw new CircuitBreakerError(
        `Circuit breaker '${this.options.name}' is open. Retry after ${retryInSeconds}s`,
        this.options.name,
        nextRetryTime
      );
    }

    return true;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.totalRequests++;
    this.totalSuccesses++;
    this.successes++;
    this.lastSuccessTime = Date.now();

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        if (this.successes >= this.options.successThreshold) {
          this.transitionTo(CircuitState.CLOSED);
          logger.info("Circuit breaker closed", {
            name: this.options.name,
            reason: "success_threshold_reached",
            successThreshold: this.options.successThreshold,
          });
        }
        break;

      case CircuitState.CLOSED:
        // Reset failure count on success in closed state
        this.failures = 0;
        break;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(error?: Error): void {
    this.totalRequests++;
    this.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();

    // Track failure timestamps for windowed counting
    this.failureTimestamps.push(Date.now());
    this.pruneOldFailures();

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Any failure in half-open reopens the circuit
        this.transitionTo(CircuitState.OPEN);
        logger.warn("Circuit breaker reopened", {
          name: this.options.name,
          reason: "failure_in_half_open",
          error: error?.message,
        });
        break;

      case CircuitState.CLOSED:
        // Check if we've exceeded failure threshold within window
        if (this.getRecentFailureCount() >= this.options.failureThreshold) {
          this.transitionTo(CircuitState.OPEN);
          logger.warn("Circuit breaker opened", {
            name: this.options.name,
            reason: "failure_threshold_exceeded",
            failures: this.failures,
            threshold: this.options.failureThreshold,
            error: error?.message,
          });
        }
        break;
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.canRequest(); // Throws if circuit is open

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.failureTimestamps = [];
    this.lastStateChange = Date.now();
    logger.info("Circuit breaker reset", { name: this.options.name });
  }

  /**
   * Force the circuit to a specific state (for testing/manual intervention)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
    logger.info("Circuit breaker state forced", {
      name: this.options.name,
      state,
    });
  }

  /**
   * Check if state should transition automatically
   */
  private checkStateTransition(): void {
    if (this.state === CircuitState.OPEN) {
      const timeSinceOpen = Date.now() - this.lastStateChange;
      if (timeSinceOpen >= this.options.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
        logger.info("Circuit breaker half-opened", {
          name: this.options.name,
          reason: "reset_timeout_elapsed",
          resetTimeoutMs: this.options.resetTimeoutMs,
        });
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.lastStateChange = Date.now();

      if (newState === CircuitState.CLOSED) {
        // Reset counters when closing
        this.failures = 0;
        this.successes = 0;
        this.failureTimestamps = [];
      } else if (newState === CircuitState.HALF_OPEN) {
        // Reset counters when transitioning to half-open
        this.successes = 0;
      }
    }
  }

  /**
   * Remove failures outside the failure window
   */
  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.options.failureWindowMs;
    this.failureTimestamps = this.failureTimestamps.filter(ts => ts > cutoff);
  }

  /**
   * Get count of failures within the window
   */
  private getRecentFailureCount(): number {
    this.pruneOldFailures();
    return this.failureTimestamps.length;
  }
}

// Global circuit breaker registry for shared circuit breakers
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a named circuit breaker
 */
export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let breaker = circuitBreakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker({ ...options, name });
    circuitBreakers.set(name, breaker);
  }
  return breaker;
}

/**
 * Reset all circuit breakers (useful for testing)
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach(breaker => breaker.reset());
}

/**
 * Clear all circuit breakers from registry (useful for testing)
 */
export function clearAllCircuitBreakers(): void {
  circuitBreakers.clear();
}

/**
 * Get stats for all circuit breakers
 */
export function getAllCircuitBreakerStats(): Map<string, CircuitBreakerStats> {
  const stats = new Map<string, CircuitBreakerStats>();
  circuitBreakers.forEach((breaker, name) => {
    stats.set(name, breaker.getStats());
  });
  return stats;
}
