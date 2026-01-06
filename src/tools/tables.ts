/**
 * Airtable tables tools
 */

import { z } from "zod";
import { extractApiKey } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";
import type { FastMCP } from "fastmcp";

export function registerTablesTools(server: FastMCP) {
  server.addTool({
  name: "list_tables",
  description: "List all tables in an Airtable base",
  parameters: z.object({
    baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
    includeFields: z.boolean().optional().default(false),
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
