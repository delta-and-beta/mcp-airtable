/**
 * Airtable records tools
 */

import { z } from "zod";
import { extractApiKey } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";
import { sanitizeFormula } from "../lib/validation.js";
import { formatErrorResponse } from "../lib/errors.js";
import type { FastMCP } from "fastmcp";

export function registerRecordsTools(server: FastMCP) {
  server.addTool({
    name: "get_records",
    description: "Retrieve records from a table with filtering and sorting",
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
      tableName: z.string().min(1).max(255),
      filterByFormula: z.string().optional(),
      maxRecords: z.number().int().min(1).max(1000).optional().default(100),
      airtableApiKey: z.string().optional(),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);

        const records = await client.getRecords(args.tableName, {
          baseId: args.baseId,
          filterByFormula: args.filterByFormula ? sanitizeFormula(args.filterByFormula) : undefined,
          maxRecords: args.maxRecords,
        });

        return JSON.stringify({ records }, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });

  server.addTool({
    name: "create_records",
    description: `Create one or more records in a table.

Accepts an array of record objects (1-1000 records). Automatically batches in chunks of 10 with 100ms delay between batches for rate limiting.

PARAMETERS:
- baseId: Base ID (starts with "app") - REQUIRED
- tableName: Table name - REQUIRED
- records: Array of { fields: {...} } objects - REQUIRED
- typecast: Auto-convert values (recommended: true)

EXAMPLE - Create single record:
{
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "records": [
    { "fields": { "Name": "Task 1", "Status": "Todo" } }
  ]
}

EXAMPLE - Create multiple records:
{
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "records": [
    { "fields": { "Name": "Task 1", "Status": "Todo" } },
    { "fields": { "Name": "Task 2", "Status": "In Progress" } },
    { "fields": { "Name": "Task 3", "Status": "Done" } }
  ],
  "typecast": true
}`,
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
      tableName: z.string().min(1).max(255),
      records: z.array(z.object({
        fields: z.record(z.string(), z.any()),
      })).min(1).max(1000),
      typecast: z.boolean().optional().default(false),
      airtableApiKey: z.string().optional(),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);

        // Extract fields from each record object
        const fieldsArray = args.records.map((r) => r.fields);

        const records = await client.createRecords(args.tableName, fieldsArray, {
          baseId: args.baseId,
          typecast: args.typecast,
        });

        return JSON.stringify({ records, count: records.length }, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });

  server.addTool({
    name: "update_record",
    description: "Update an existing record",
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
      tableName: z.string().min(1).max(255),
      recordId: z.string().regex(/^rec[a-zA-Z0-9]{14}$/),
      fields: z.record(z.string(), z.any()),
      typecast: z.boolean().optional().default(false),
      airtableApiKey: z.string().optional(),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);

        const record = await client.updateRecord(
          args.tableName,
          args.recordId,
          args.fields,
          {
            baseId: args.baseId,
            typecast: args.typecast,
          }
        );

        return JSON.stringify(record, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });

  // get_record tool
  server.addTool({
    name: "get_record",
    description: "Get a single record by its ID",
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
      tableName: z.string().min(1).max(255),
      recordId: z.string().regex(/^rec[a-zA-Z0-9]{14}$/),
      airtableApiKey: z.string().optional(),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);

        const record = await client.getRecord(args.tableName, args.recordId, args.baseId);

        return JSON.stringify(record, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });

  // delete_record tool
  server.addTool({
    name: "delete_record",
    description: "Permanently delete a single record. WARNING: Cannot be undone.",
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
      tableName: z.string().min(1).max(255),
      recordId: z.string().regex(/^rec[a-zA-Z0-9]{14}$/),
      airtableApiKey: z.string().optional(),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);

        const result = await client.deleteRecord(args.tableName, args.recordId, args.baseId);

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });
}

