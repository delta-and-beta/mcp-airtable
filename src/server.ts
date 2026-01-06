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

// Register tools (side-effect imports)
import "./tools/bases.js";
import "./tools/tables.js";
import "./tools/records.js";

// Start server function
export function startServer(transport: "stdio" | "httpStream" = "httpStream") {
  const port = parseInt(process.env.PORT || "3000");

  console.log(`Starting MCP Airtable server...`);
  console.log(`Transport: ${transport}`);
  console.log(`Port: ${port}`);

  server.start({
    transportType: transport,
    httpStream: {
      port,
      stateless: false, // Track sessions for Claude Desktop
    },
  });
}

// Additional tool imports
import "./tools/batch.js";
