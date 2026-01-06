/**
 * FastMCP server for Airtable integration
 * Clean implementation with streamable-HTTP transport
 */

import { FastMCP } from "fastmcp";

// Initialize FastMCP server (MUST be before tool imports)
export const server = new FastMCP({
  name: "mcp-airtable",
  version: "1.0.0",
});

// Register tools (side-effect imports - AFTER server export)
import "./tools/bases.js";
import "./tools/tables.js";
import "./tools/records.js";
import "./tools/batch.js";

// Import logger after tools to avoid circular deps
import { logger } from "./lib/logger.js";
logger.info("MCP Airtable server initialized", { version: "1.0.0", tools: 10 });

// Health check will be available via FastMCP's built-in endpoints

// Start server function
export function startServer(transport: "stdio" | "httpStream" = "httpStream") {
  const port = parseInt(process.env.PORT || "3000");

  logger.info("Starting MCP Airtable server", { transport, port });

  server.start({
    transportType: transport,
    httpStream: {
      port,
      stateless: false, // Track sessions for Claude Desktop
    },
  });
}

