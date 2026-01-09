/**
 * Airtable bases tools
 */

import { z } from "zod";
import { extractApiKey, extractWorkspaceId } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";
import { formatErrorResponse } from "../lib/errors.js";
import type { FastMCP } from "fastmcp";

export function registerBasesTools(server: FastMCP) {
  // list_workspaces tool
  server.addTool({
    name: "list_workspaces",
    description: `List all Airtable workspaces accessible with the provided API key.

Use this to get workspace IDs needed for create_base.

NOTE: This endpoint may require Enterprise plan or specific API scopes.
If you get a 404 error, get workspace ID from the Airtable UI URL instead:
- Open Airtable in browser
- Navigate to the workspace
- The URL will be: airtable.com/wspXXXXXXXXXXXXXXX/...
- Copy the wsp... ID

RETURNS:
{
  "workspaces": [
    { "id": "wspmhESAta6clCCwF", "name": "My Workspace", "permissionLevel": "owner" }
  ]
}`,
    parameters: z.object({
      airtableApiKey: z.string().optional(),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey);
        const workspaces = await client.listWorkspaces();

        return JSON.stringify({ workspaces }, null, 2);
      } catch (error: any) {
        // Provide helpful error for 404/NOT_FOUND
        if (error.statusCode === 404 || error.message?.includes("Not Found")) {
          return JSON.stringify({
            error: "WorkspacesAPIUnavailable",
            message: "The workspaces API is not available for your account. This may require an Enterprise plan or specific API scopes.",
            workaround: "Get workspace ID from the Airtable UI URL: Open Airtable browser > Navigate to workspace > Copy wspXXX from URL (airtable.com/wspXXXXXXXXXXXXXXX/...)"
          }, null, 2);
        }
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error)), { tool: "list_workspaces" }), null, 2);
      }
    },
  });

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
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error)), { tool: "list_bases" }), null, 2);
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
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error)), { tool: "get_base_schema" }), null, 2);
      }
    },
  });

  // create_base tool
  server.addTool({
    name: "create_base",
    description: `Create a new Airtable base in a workspace.

WORKSPACE ID:
workspaceId can be provided via (in priority order):
1. x-airtable-workspace-id header (set once during session init)
2. workspaceId parameter in this request
3. AIRTABLE_WORKSPACE_ID environment variable

To get a workspace ID:
- list_workspaces tool (if available for your plan)
- Airtable UI URL: airtable.com/wspXXXXXXXXXXXXXXX/... (copy the wsp... ID)

REQUIREMENTS:
- At least one table with at least one field must be provided
- The first field of the first table becomes the primary field

EXAMPLE:
{
  "name": "Project Tracker",
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
      workspaceId: z.string().optional().describe("Workspace ID (starts with 'wsp'). Optional if set via x-airtable-workspace-id header"),
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
        const workspaceId = extractWorkspaceId(args, context);

        if (!workspaceId) {
          return JSON.stringify({
            error: "ValidationError",
            message: "Workspace ID required. Provide via: (1) x-airtable-workspace-id header, (2) workspaceId parameter, or (3) AIRTABLE_WORKSPACE_ID env var.",
            hint: "Get workspace ID from Airtable UI URL: airtable.com/wspXXXXXXXXXXXXXXX/..."
          }, null, 2);
        }

        const client = new AirtableClient(apiKey);
        const result = await client.createBase({
          name: args.name,
          workspaceId: workspaceId,
          tables: args.tables,
        });

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error)), { tool: "create_base" }), null, 2);
      }
    },
  });
}
