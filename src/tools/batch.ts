/**
 * Airtable batch operation tools
 */

import { server } from "../server.js";
import { z } from "zod";
import { extractApiKey } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";

server.addTool({
  name: "batch_upsert",
  description: "Create or update multiple records (up to 1000)",
  parameters: z.object({
    baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
    tableName: z.string(),
    records: z.array(z.object({
      id: z.string().optional(),
      fields: z.record(z.string(), z.any()),
    })).min(1).max(1000),
    typecast: z.boolean().optional().default(false),
    airtableApiKey: z.string().optional(),
  }),
  execute: async (args, context) => {
    const apiKey = extractApiKey(args, context);
    const base = new (require('airtable')).default({ apiKey }).base(args.baseId);
    const table = base(args.tableName);
    
    const allRecords = [];
    
    // Process in chunks of 10
    for (let i = 0; i < args.records.length; i += 10) {
      const chunk = args.records.slice(i, i + 10);
      const toCreate = chunk.filter(r => !r.id).map(r => r.fields);
      const toUpdate = chunk.filter(r => r.id).map(r => ({ id: r.id!, fields: r.fields }));
      
      if (toCreate.length > 0) {
        const created: any = await table.create(toCreate as any, { typecast: args.typecast });
        allRecords.push(...(Array.isArray(created) ? created : [created]));
      }
      
      if (toUpdate.length > 0) {
        const updated: any = await table.update(toUpdate as any, { typecast: args.typecast });
        allRecords.push(...(Array.isArray(updated) ? updated : [updated]));
      }
    }
    
    return JSON.stringify({
      records: allRecords.map((r: any) => ({ id: r.id, fields: r.fields })),
      count: allRecords.length,
    }, null, 2);
  },
});

server.addTool({
  name: "batch_delete",
  description: "Delete multiple records (up to 1000). WARNING: Cannot be undone",
  parameters: z.object({
    baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
    tableName: z.string(),
    recordIds: z.array(z.string()).min(1).max(1000),
    airtableApiKey: z.string().optional(),
  }),
  execute: async (args, context) => {
    const apiKey = extractApiKey(args, context);
    const base = new (require('airtable')).default({ apiKey }).base(args.baseId);
    const table = base(args.tableName);
    
    const allDeleted = [];
    
    // Process in chunks of 10
    for (let i = 0; i < args.recordIds.length; i += 10) {
      const chunk = args.recordIds.slice(i, i + 10);
      const results: any = await table.destroy(chunk);
      allDeleted.push(...(Array.isArray(results) ? results : [results]));
    }
    
    return JSON.stringify({
      records: allDeleted.map((r: any) => ({ id: r.id, deleted: true })),
      count: allDeleted.length,
    }, null, 2);
  },
});
