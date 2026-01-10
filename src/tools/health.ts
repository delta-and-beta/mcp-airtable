/**
 * Health check tool for MCP server
 * Exposes service health as an MCP tool
 */

import { z } from "zod";
import type { FastMCP } from "fastmcp";
import {
  checkHealth,
  checkLiveness,
  checkReadiness,
  formatHealthResult,
} from "../lib/health.js";

/**
 * Register health check tools with the server
 */
export function registerHealthTools(server: FastMCP<any>) {
  // Detailed health check
  server.addTool({
    name: "health_check",
    description: "Get detailed health status of the MCP server including circuit breakers, memory usage, and uptime",
    parameters: z.object({
      format: z.enum(["json", "text"]).optional().describe("Output format (default: json)"),
    }),
    execute: async (args, context) => {
      const health = checkHealth("1.0.0");

      if (args.format === "text") {
        return formatHealthResult(health);
      }

      // Convert Map to object for JSON serialization
      const circuitBreakerStats: Record<string, any> = {};
      for (const [name, stats] of health.stats.circuitBreakers) {
        circuitBreakerStats[name] = stats;
      }

      return JSON.stringify({
        ...health,
        stats: {
          ...health.stats,
          circuitBreakers: circuitBreakerStats,
        },
      }, null, 2);
    },
  });

  // Liveness probe (for k8s/container orchestration)
  server.addTool({
    name: "liveness",
    description: "Liveness probe - check if the service is running",
    parameters: z.object({}),
    execute: async () => {
      const result = checkLiveness();
      return JSON.stringify(result);
    },
  });

  // Readiness probe (for k8s/container orchestration)
  server.addTool({
    name: "readiness",
    description: "Readiness probe - check if the service is ready to accept requests",
    parameters: z.object({}),
    execute: async () => {
      const result = checkReadiness();
      return JSON.stringify(result);
    },
  });
}
