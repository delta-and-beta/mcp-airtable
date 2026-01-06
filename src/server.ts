/**
 * FastMCP server for Airtable integration
 * Clean implementation with streamable-HTTP transport
 */

import { FastMCP } from "fastmcp";

// Initialize FastMCP server
export const server = new FastMCP({
  name: "mcp-airtable",
  version: "1.0.0",
});

// Import tool registration functions
import { registerBasesTools } from "./tools/bases.js";
import { registerTablesTools } from "./tools/tables.js";
import { registerRecordsTools } from "./tools/records.js";
import { registerBatchTools } from "./tools/batch.js";
import { logger } from "./lib/logger.js";

// Register all tools
registerBasesTools(server);
registerTablesTools(server);
registerRecordsTools(server);
registerBatchTools(server);

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

