/**
 * FastMCP server for Airtable integration
 * Clean implementation with streamable-HTTP transport
 */

import { FastMCP } from "fastmcp";
import type { IncomingHttpHeaders } from "http";

// Session data type - stores HTTP headers for tool access
interface SessionData {
  headers: IncomingHttpHeaders;
  lastActivity: number;
  [key: string]: unknown; // Index signature required by FastMCPSessionAuth
}

// Session activity tracking for cleanup
const sessionActivity = new Map<string, number>();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Initialize FastMCP server with authentication to capture headers
export const server = new FastMCP<SessionData>({
  name: "mcp-airtable",
  version: "1.0.0",
  authenticate: async (request): Promise<SessionData> => {
    // Track session activity for cleanup monitoring
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    if (sessionId) {
      sessionActivity.set(sessionId, Date.now());
    }

    // Capture HTTP headers and store in session
    // This allows tools to access headers via context.session.headers
    return {
      headers: request.headers,
      lastActivity: Date.now(),
    };
  },
});

// Session cleanup interval - removes stale session tracking data
// Note: FastMCP manages actual session lifecycle; this cleans our tracking map
let cleanupInterval: NodeJS.Timeout | null = null;

function startSessionCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, lastActivity] of sessionActivity) {
      if (now - lastActivity > SESSION_TIMEOUT_MS) {
        sessionActivity.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      // Import logger lazily to avoid circular dependency
      import("./lib/logger.js").then(({ logger }) => {
        logger.debug("Session cleanup completed", { cleaned, remaining: sessionActivity.size });
      });
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent process exit
  cleanupInterval.unref();
}

export function stopSessionCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Import tool registration functions
import { registerBasesTools } from "./tools/bases.js";
import { registerTablesTools } from "./tools/tables.js";
import { registerRecordsTools } from "./tools/records.js";
import { registerBatchTools } from "./tools/batch.js";
import { registerFieldsTools } from "./tools/fields.js";
import { registerCommentsTools } from "./tools/comments.js";
import { logger } from "./lib/logger.js";

// Register all tools
registerBasesTools(server);
registerTablesTools(server);
registerRecordsTools(server);
registerBatchTools(server);
registerFieldsTools(server);
registerCommentsTools(server);

logger.info("MCP Airtable server initialized", { version: "1.0.0", tools: 20 });

// Health check will be available via FastMCP's built-in endpoints

// Start server function
export function startServer(transport: "stdio" | "httpStream" = "httpStream") {
  const port = parseInt(process.env.PORT || "3000");
  const host = process.env.HOST || "0.0.0.0"; // Default to all interfaces for k8s

  logger.info("Starting MCP Airtable server", { transport, host, port });

  // Start session cleanup for HTTP transport (memory leak prevention)
  if (transport === "httpStream") {
    startSessionCleanup();
    logger.debug("Session cleanup started", {
      timeoutMs: SESSION_TIMEOUT_MS,
      intervalMs: CLEANUP_INTERVAL_MS
    });
  }

  server.start({
    transportType: transport,
    httpStream: {
      host,
      port,
      stateless: false, // Track sessions for Claude Desktop
    },
  });
}

