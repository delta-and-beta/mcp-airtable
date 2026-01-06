/**
 * Airtable bases tools
 */

import { z } from "zod";
import { extractApiKey } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";
import type { FastMCP } from "fastmcp";

export function registerBasesTools(server: FastMCP) {
  // list_bases tool
  server.addTool({
  name: "list_bases",
  description: "List all Airtable bases accessible with the provided API key",
  parameters: z.object({
    airtableApiKey: z.string().optional(),
  }),
  execute: async (args, context) => {
    const apiKey = extractApiKey(args, context);
    const client = new AirtableClient(apiKey);
    const bases = await client.listBases();

    // Return as JSON string (FastMCP requirement)
    return JSON.stringify({ bases }, null, 2);
  },
});

// get_schema tool
server.addTool({
  name: "get_schema",
  description: "Get the complete schema of a base including all tables, fields, and views",
  parameters: z.object({
    baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
    airtableApiKey: z.string().optional(),
  }),
  execute: async (args, context) => {
    const apiKey = extractApiKey(args, context);
    const client = new AirtableClient(apiKey, args.baseId);
    const tables = await client.listTables(args.baseId);

    return JSON.stringify({ tables }, null, 2);
  },
  });
}
