/**
 * Entry point for MCP Airtable server
 */

import { config } from "dotenv";
import { startServer } from "./server.js";

// Load environment variables
config();

// Start server (HTTP by default, stdio if CLI arg)
const transport = process.argv.includes("--stdio") ? "stdio" : "httpStream";
startServer(transport as "stdio" | "httpStream");
