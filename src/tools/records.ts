/**
 * Airtable records tools
 */

import { server } from "../server.js";
import { z } from "zod";
import { extractApiKey } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";

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
    const apiKey = extractApiKey(args, context);
    const client = new AirtableClient(apiKey, args.baseId);

    const records = await client.getRecords(args.tableName, {
      baseId: args.baseId,
      filterByFormula: args.filterByFormula ? sanitizeFormula(args.filterByFormula) : undefined,
      maxRecords: args.maxRecords,
    });

    return JSON.stringify({ records }, null, 2);
  },
});

server.addTool({
  name: "create_record",
  description: "Create a new record in a table",
  parameters: z.object({
    baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
    tableName: z.string().min(1).max(255),
    fields: z.record(z.string(), z.any()),
    typecast: z.boolean().optional().default(false),
    airtableApiKey: z.string().optional(),
  }),
  execute: async (args, context) => {
    const apiKey = extractApiKey(args, context);
    const client = new AirtableClient(apiKey, args.baseId);

    const record = await client.createRecord(args.tableName, args.fields as any, {
      baseId: args.baseId,
      typecast: args.typecast,
    });

    return JSON.stringify(record, null, 2);
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
    const apiKey = extractApiKey(args, context);
    const client = new AirtableClient(apiKey, args.baseId);

    const record = await client.updateRecord(
      args.tableName,
      args.recordId,
      args.fields as any,
      {
        baseId: args.baseId,
        typecast: args.typecast,
      }
    );

    return JSON.stringify(record, null, 2);
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
    const apiKey = extractApiKey(args, context);
    const client = new AirtableClient(apiKey, args.baseId);
    
    const base = (client as any).airtable.base(args.baseId);
    const table = base(args.tableName);
    const record: any = await table.find(args.recordId);
    
    return JSON.stringify({
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson?.createdTime,
    }, null, 2);
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
    const apiKey = extractApiKey(args, context);
    const client = new AirtableClient(apiKey, args.baseId);
    
    const base = (client as any).airtable.base(args.baseId);
    const table = base(args.tableName);
    const result: any = await table.destroy(args.recordId);
    
    return JSON.stringify({
      id: result.id,
      deleted: true,
    }, null, 2);
  },
});

// Update get_records to use formula sanitization
import { sanitizeFormula } from "../lib/validation.js";
