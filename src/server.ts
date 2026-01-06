/**
 * FastMCP server for Airtable integration
 * Clean implementation with streamable-HTTP transport
 */

import { FastMCP } from "fastmcp";
import { logger } from "./lib/logger.js";

// Log configuration on startup
logger.info("Initializing MCP Airtable server", { version: "1.0.0" });

// Initialize FastMCP server
export const server = new FastMCP({
  name: "mcp-airtable",
  version: "1.0.0",
});

// Register tools (side-effect imports)
import "./tools/bases.js";
import "./tools/tables.js";
import "./tools/records.js";
import "./tools/batch.js";

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

