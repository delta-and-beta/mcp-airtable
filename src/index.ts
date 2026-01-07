/**
 * Entry point for MCP Airtable server
 */

import { config } from "dotenv";
import { configureIPv4OnlyFetch } from "./lib/network.js";
import { startServer } from "./server.js";

// Load environment variables
config();

// Configure network to use IPv4-only DNS (fixes Docker/container networking issues)
configureIPv4OnlyFetch();

// Start server (HTTP by default, stdio if CLI arg)
const transport = process.argv.includes("--stdio") ? "stdio" : "httpStream";
startServer(transport as "stdio" | "httpStream");
