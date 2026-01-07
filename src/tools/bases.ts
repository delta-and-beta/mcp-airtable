/**
 * Airtable bases tools
 */

import { z } from "zod";
import { extractApiKey } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";
import { formatErrorResponse } from "../lib/errors.js";
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
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey);
        const bases = await client.listBases();

        return JSON.stringify({ bases }, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });

  // get_base_schema tool
  server.addTool({
    name: "get_base_schema",
    description: "Get the complete schema of a base including all tables, fields, and views",
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
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

  // create_base tool
  server.addTool({
    name: "create_base",
    description: `Create a new Airtable base in a workspace.

REQUIREMENTS:
- workspaceId is required (get from Airtable workspace URL or list_bases response)
- At least one table with at least one field must be provided
- The first field of the first table becomes the primary field

EXAMPLE:
{
  "name": "Project Tracker",
  "workspaceId": "wspmhESAta6clCCwF",
  "tables": [
    {
      "name": "Tasks",
      "description": "Project tasks",
      "fields": [
        { "name": "Task Name", "type": "singleLineText" },
        { "name": "Status", "type": "singleSelect", "options": { "choices": [{"name": "Todo"}, {"name": "Done"}] } }
      ]
    }
  ]
}

RETURNS: Base ID, name, and created tables with their IDs`,
    parameters: z.object({
      name: z.string().min(1).max(255).describe("Name for the new base"),
      workspaceId: z.string().min(1).describe("Workspace ID (starts with 'wsp')"),
      tables: z
        .array(
          z.object({
            name: z.string().min(1).max(255).describe("Table name"),
            description: z.string().max(20000).optional().describe("Table description"),
            fields: z
              .array(
                z.object({
                  name: z.string().min(1).max(255).describe("Field name"),
                  type: z.string().describe("Field type (singleLineText, number, singleSelect, etc.)"),
                  description: z.string().max(20000).optional().describe("Field description"),
                  options: z.record(z.unknown()).optional().describe("Type-specific options"),
                })
              )
              .min(1)
              .describe("Fields for the table"),
          })
        )
        .min(1)
        .describe("Tables to create in the base"),
      airtableApiKey: z.string().optional().describe("Airtable API key (optional if passed via header)"),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey);
        const result = await client.createBase({
          name: args.name,
          workspaceId: args.workspaceId,
          tables: args.tables,
        });

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });
}
