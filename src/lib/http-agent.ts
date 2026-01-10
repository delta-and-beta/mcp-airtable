/**
 * HTTP Agent configuration for connection pooling and keep-alive
 * Optimizes repeated API calls to Airtable
 */

import { Agent } from "undici";
import { logger } from "./logger.js";

export interface HttpAgentOptions {
  /** Maximum connections per origin (default: 10) */
  maxConnections?: number;
  /** Keep-alive timeout in ms (default: 30000) */
  keepAliveTimeout?: number;
  /** Maximum idle time per connection in ms (default: 60000) */
  keepAliveMaxTimeout?: number;
  /** Enable pipelining (default: true) */
  pipelining?: number;
  /** Connect timeout in ms (default: 10000) */
  connectTimeout?: number;
}

export interface HttpAgentStats {
  pendingRequests: number;
  runningRequests: number;
  totalConnections: number;
  freeConnections: number;
  busyConnections: number;
}

const DEFAULT_OPTIONS: Required<HttpAgentOptions> = {
  maxConnections: 10,
  keepAliveTimeout: 30000,
  keepAliveMaxTimeout: 60000,
  pipelining: 1,
  connectTimeout: 10000,
};

// Global agent for connection pooling
let globalAgent: Agent | null = null;

/**
 * Get or create the global HTTP agent
 */
export function getHttpAgent(options?: HttpAgentOptions): Agent {
  if (!globalAgent) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    globalAgent = new Agent({
      connections: opts.maxConnections,
      keepAliveTimeout: opts.keepAliveTimeout,
      keepAliveMaxTimeout: opts.keepAliveMaxTimeout,
      pipelining: opts.pipelining,
      connect: {
        timeout: opts.connectTimeout,
      },
    });

    logger.info("HTTP agent initialized", {
      maxConnections: opts.maxConnections,
      keepAliveTimeout: opts.keepAliveTimeout,
      pipelining: opts.pipelining,
    });
  }

  return globalAgent;
}

/**
 * Safely get a numeric stat value with fallback to 0
 */
function getStatValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

/**
 * Get stats from the HTTP agent
 */
export function getHttpAgentStats(): HttpAgentStats | null {
  if (!globalAgent) {
    return null;
  }

  const stats = globalAgent.stats;
  return {
    pendingRequests: getStatValue(stats.pending),
    runningRequests: getStatValue(stats.running),
    totalConnections: getStatValue(stats.connected),
    freeConnections: getStatValue(stats.free),
    busyConnections: getStatValue(stats.size),
  };
}

/**
 * Close the global HTTP agent (for cleanup)
 */
export async function closeHttpAgent(): Promise<void> {
  if (globalAgent) {
    await globalAgent.close();
    globalAgent = null;
    logger.info("HTTP agent closed");
  }
}

/**
 * Create a fetch function that uses the global agent
 * Use this to make requests with connection pooling
 */
export function createPooledFetch(options?: HttpAgentOptions): typeof fetch {
  const agent = getHttpAgent(options);

  return (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      // @ts-expect-error - dispatcher is a Node.js/undici specific option
      dispatcher: agent,
    });
  };
}

/**
 * Make a fetch request using the global pooled agent
 */
export function pooledFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const agent = getHttpAgent();

  return fetch(input, {
    ...init,
    // @ts-expect-error - dispatcher is a Node.js/undici specific option
    dispatcher: agent,
  });
}
