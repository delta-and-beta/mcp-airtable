/**
 * FastMCP server for Airtable integration
 * Clean implementation with streamable-HTTP transport
 */

import { FastMCP } from "fastmcp";
import type { IncomingHttpHeaders } from "http";

// Session data type - stores HTTP headers for tool access
interface SessionData {
  headers: IncomingHttpHeaders;
  [key: string]: unknown; // Index signature required by FastMCPSessionAuth
}

// Initialize FastMCP server with authentication to capture headers
export const server = new FastMCP<SessionData>({
  name: "mcp-airtable",
  version: "1.0.0",
  authenticate: async (request): Promise<SessionData> => {
    // Capture HTTP headers and store in session
    // This allows tools to access headers via context.session.headers
    return {
      headers: request.headers,
    };
  },
});

// Import tool registration functions
import { registerBasesTools } from "./tools/bases.js";
import { registerTablesTools } from "./tools/tables.js";
import { registerRecordsTools } from "./tools/records.js";
import { registerBatchTools } from "./tools/batch.js";
import { registerFieldsTools } from "./tools/fields.js";
import { logger } from "./lib/logger.js";

// Register all tools
registerBasesTools(server);
registerTablesTools(server);
registerRecordsTools(server);
registerBatchTools(server);
registerFieldsTools(server);

logger.info("MCP Airtable server initialized", { version: "1.0.0", tools: 12 });

// Health check will be available via FastMCP's built-in endpoints

// Start server function
export function startServer(transport: "stdio" | "httpStream" = "httpStream") {
  const port = parseInt(process.env.PORT || "3000");
  const host = process.env.HOST || "0.0.0.0"; // Default to all interfaces for k8s

  logger.info("Starting MCP Airtable server", { transport, host, port });

  server.start({
    transportType: transport,
    httpStream: {
      host,
      port,
      stateless: false, // Track sessions for Claude Desktop
    },
  });
}

