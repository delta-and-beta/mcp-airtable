/**
 * Airtable tables tools
 */

import { z } from "zod";
import { extractApiKey } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";
import { formatErrorResponse } from "../lib/errors.js";
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
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);
        const tables = await client.listTables(args.baseId);

        return JSON.stringify({ tables }, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });

  // create_table tool
  server.addTool({
    name: "create_table",
    description: `Create a new table in an existing Airtable base.

REQUIREMENTS:
- At least one field must be provided
- The first field becomes the primary field (usually singleLineText)
- Field names must be unique within the table

COMMON FIELD TYPES:
- singleLineText, multilineText, email, url, phoneNumber
- number, percent, currency, checkbox, date, dateTime
- singleSelect, multipleSelects (require choices option)
- multipleRecordLinks (requires linkedTableId option)
- multipleAttachments, richText, rating, duration

EXAMPLE:
{
  "baseId": "appABC123def456gh",
  "name": "Tasks",
  "description": "Project tasks",
  "fields": [
    { "name": "Task Name", "type": "singleLineText" },
    { "name": "Status", "type": "singleSelect", "options": { "choices": [{"name": "Todo"}, {"name": "In Progress"}, {"name": "Done"}] } },
    { "name": "Due Date", "type": "date" },
    { "name": "Completed", "type": "checkbox" }
  ]
}

RETURNS: Table ID, name, primary field ID, fields, and views`,
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/).describe("Base ID (starts with 'app')"),
      name: z.string().min(1).max(255).describe("Table name"),
      description: z.string().max(20000).optional().describe("Table description"),
      fields: z
        .array(
          z.object({
            name: z.string().min(1).max(255).describe("Field name"),
            type: z.string().describe("Field type"),
            description: z.string().max(20000).optional().describe("Field description"),
            options: z.record(z.unknown()).optional().describe("Type-specific options"),
          })
        )
        .min(1)
        .describe("Fields to create in the table"),
      airtableApiKey: z.string().optional().describe("Airtable API key (optional if passed via header)"),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);
        const result = await client.createTable(args.baseId, {
          name: args.name,
          description: args.description,
          fields: args.fields,
        });

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });
}
