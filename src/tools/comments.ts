/**
 * Airtable comments tools
 */

import { z } from "zod";
import { extractApiKey } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";
import { formatErrorResponse } from "../lib/errors.js";
import type { FastMCP } from "fastmcp";

export function registerCommentsTools(server: FastMCP) {
  // list_comments tool
  server.addTool({
    name: "list_comments",
    description: `List all comments on a specific record.

PARAMETERS:
- baseId: Base ID (starts with "app") - REQUIRED
- tableIdOrName: Table ID or name - REQUIRED
- recordId: Record ID (starts with "rec") - REQUIRED
- pageSize: Number of comments per page (max 100)
- offset: Pagination offset from previous response

RETURNS:
{
  "comments": [
    {
      "id": "comXYZ789abc012de",
      "author": { "id": "usrABC123", "email": "user@example.com", "name": "John Doe" },
      "text": "This looks good!",
      "createdTime": "2024-01-15T10:30:00.000Z",
      "lastUpdatedTime": "2024-01-15T11:00:00.000Z"
    }
  ],
  "offset": "..." // Use for pagination
}

EXAMPLE:
{
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Tasks",
  "recordId": "recXYZ789abc012de"
}`,
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/).describe("Base ID (starts with 'app')"),
      tableIdOrName: z.string().min(1).describe("Table ID (starts with 'tbl') or table name"),
      recordId: z.string().regex(/^rec[a-zA-Z0-9]{14}$/).describe("Record ID (starts with 'rec')"),
      pageSize: z.number().min(1).max(100).optional().describe("Number of comments per page (max 100)"),
      offset: z.string().optional().describe("Pagination offset from previous response"),
      airtableApiKey: z.string().optional().describe("Airtable API key (optional if passed via header)"),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);
        const result = await client.listComments(args.tableIdOrName, args.recordId, {
          baseId: args.baseId,
          pageSize: args.pageSize,
          offset: args.offset,
        });

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error)), { tool: "list_comments" }), null, 2);
      }
    },
  });

  // create_comment tool
  server.addTool({
    name: "create_comment",
    description: `Create a comment on a record.

PARAMETERS:
- baseId: Base ID (starts with "app") - REQUIRED
- tableIdOrName: Table ID or name - REQUIRED
- recordId: Record ID (starts with "rec") - REQUIRED
- text: Comment text - REQUIRED

USER MENTIONS:
To mention a user in a comment, use the format: @[usrXXXXXXXXXXXXXX]
Example: "Hey @[usr123ABC456def] please review this"

RETURNS:
{
  "id": "comXYZ789abc012de",
  "author": { "id": "usrABC123", "email": "user@example.com", "name": "John Doe" },
  "text": "This looks good!",
  "createdTime": "2024-01-15T10:30:00.000Z"
}

EXAMPLE:
{
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Tasks",
  "recordId": "recXYZ789abc012de",
  "text": "Approved! Moving to production."
}`,
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/).describe("Base ID (starts with 'app')"),
      tableIdOrName: z.string().min(1).describe("Table ID (starts with 'tbl') or table name"),
      recordId: z.string().regex(/^rec[a-zA-Z0-9]{14}$/).describe("Record ID (starts with 'rec')"),
      text: z.string().min(1).describe("Comment text. Use @[usrXXX] format to mention users."),
      airtableApiKey: z.string().optional().describe("Airtable API key (optional if passed via header)"),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);
        const result = await client.createComment(
          args.tableIdOrName,
          args.recordId,
          args.text,
          args.baseId
        );

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error)), { tool: "create_comment" }), null, 2);
      }
    },
  });

  // update_comment tool
  server.addTool({
    name: "update_comment",
    description: `Update a comment on a record. Only the comment author can update their own comment.

PARAMETERS:
- baseId: Base ID (starts with "app") - REQUIRED
- tableIdOrName: Table ID or name - REQUIRED
- recordId: Record ID (starts with "rec") - REQUIRED
- commentId: Comment ID (starts with "com") - REQUIRED
- text: New comment text - REQUIRED

RETURNS:
{
  "id": "comXYZ789abc012de",
  "author": { "id": "usrABC123", "email": "user@example.com", "name": "John Doe" },
  "text": "Updated comment text",
  "createdTime": "2024-01-15T10:30:00.000Z",
  "lastUpdatedTime": "2024-01-15T11:00:00.000Z"
}

EXAMPLE:
{
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Tasks",
  "recordId": "recXYZ789abc012de",
  "commentId": "comABC123def456gh",
  "text": "Updated: Actually, needs more review."
}`,
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/).describe("Base ID (starts with 'app')"),
      tableIdOrName: z.string().min(1).describe("Table ID (starts with 'tbl') or table name"),
      recordId: z.string().regex(/^rec[a-zA-Z0-9]{14}$/).describe("Record ID (starts with 'rec')"),
      commentId: z.string().min(1).describe("Comment ID (starts with 'com')"),
      text: z.string().min(1).describe("New comment text"),
      airtableApiKey: z.string().optional().describe("Airtable API key (optional if passed via header)"),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);
        const result = await client.updateComment(
          args.tableIdOrName,
          args.recordId,
          args.commentId,
          args.text,
          args.baseId
        );

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error)), { tool: "update_comment" }), null, 2);
      }
    },
  });

  // delete_comment tool
  server.addTool({
    name: "delete_comment",
    description: `Delete a comment from a record. Only the comment author can delete their own comment.

WARNING: This action cannot be undone.

PARAMETERS:
- baseId: Base ID (starts with "app") - REQUIRED
- tableIdOrName: Table ID or name - REQUIRED
- recordId: Record ID (starts with "rec") - REQUIRED
- commentId: Comment ID (starts with "com") - REQUIRED

RETURNS:
{
  "id": "comXYZ789abc012de",
  "deleted": true
}

EXAMPLE:
{
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Tasks",
  "recordId": "recXYZ789abc012de",
  "commentId": "comABC123def456gh"
}`,
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/).describe("Base ID (starts with 'app')"),
      tableIdOrName: z.string().min(1).describe("Table ID (starts with 'tbl') or table name"),
      recordId: z.string().regex(/^rec[a-zA-Z0-9]{14}$/).describe("Record ID (starts with 'rec')"),
      commentId: z.string().min(1).describe("Comment ID (starts with 'com')"),
      airtableApiKey: z.string().optional().describe("Airtable API key (optional if passed via header)"),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);
        const result = await client.deleteComment(
          args.tableIdOrName,
          args.recordId,
          args.commentId,
          args.baseId
        );

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error)), { tool: "delete_comment" }), null, 2);
      }
    },
  });
}
