/**
 * Airtable batch operation tools
 *
 * Implements partial failure handling: if some chunks fail,
 * the operation continues and returns both succeeded and failed records.
 */

import { z } from "zod";
import Airtable from "airtable";
import { extractApiKey } from "../lib/auth.js";
import { formatErrorResponse } from "../lib/errors.js";
import type { FastMCP } from "fastmcp";

// Types for batch operation results
interface BatchUpsertSuccess {
  id: string;
  fields: Record<string, unknown>;
}

interface BatchDeleteSuccess {
  id: string;
  deleted: true;
}

interface BatchFailure {
  chunkIndex: number;
  error: string;
  recordIds: string[];
}

interface BatchUpsertResult {
  succeeded: BatchUpsertSuccess[];
  failed: BatchFailure[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

interface BatchDeleteResult {
  succeeded: BatchDeleteSuccess[];
  failed: BatchFailure[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export function registerBatchTools(server: FastMCP) {
  server.addTool({
    name: "batch_upsert",
    description: "Create or update multiple records (up to 1000). Returns partial results if some chunks fail.",
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
      try {
        const apiKey = extractApiKey(args, context);
        const base = new Airtable({ apiKey }).base(args.baseId);
        const table = base(args.tableName);

        const succeeded: BatchUpsertSuccess[] = [];
        const failed: BatchFailure[] = [];

        // Process in chunks of 10
        for (let i = 0; i < args.records.length; i += 10) {
          const chunkIndex = Math.floor(i / 10);
          const chunk = args.records.slice(i, i + 10);
          const chunkRecordIds = chunk.map(r => r.id || `new_${i + chunk.indexOf(r)}`);

          try {
            const toCreate = chunk.filter(r => !r.id).map(r => r.fields);
            const toUpdate = chunk.filter(r => r.id).map(r => ({ id: r.id!, fields: r.fields }));

            if (toCreate.length > 0) {
              const created = await table.create(toCreate, { typecast: args.typecast });
              const createdArray = Array.isArray(created) ? created : [created];
              succeeded.push(...createdArray.map((r: any) => ({ id: r.id, fields: r.fields })));
            }

            if (toUpdate.length > 0) {
              const updated = await table.update(toUpdate, { typecast: args.typecast });
              const updatedArray = Array.isArray(updated) ? updated : [updated];
              succeeded.push(...updatedArray.map((r: any) => ({ id: r.id, fields: r.fields })));
            }
          } catch (chunkError) {
            // Record the failure but continue processing remaining chunks
            failed.push({
              chunkIndex,
              error: chunkError instanceof Error ? chunkError.message : String(chunkError),
              recordIds: chunkRecordIds,
            });
          }
        }

        const result: BatchUpsertResult = {
          succeeded,
          failed,
          summary: {
            total: args.records.length,
            succeeded: succeeded.length,
            failed: failed.reduce((acc, f) => acc + f.recordIds.length, 0),
          },
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });

  server.addTool({
    name: "batch_delete",
    description: "Delete multiple records (up to 1000). WARNING: Cannot be undone. Returns partial results if some chunks fail.",
    parameters: z.object({
      baseId: z.string().regex(/^app[a-zA-Z0-9]{14}$/),
      tableName: z.string(),
      recordIds: z.array(z.string()).min(1).max(1000),
      airtableApiKey: z.string().optional(),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const base = new Airtable({ apiKey }).base(args.baseId);
        const table = base(args.tableName);

        const succeeded: BatchDeleteSuccess[] = [];
        const failed: BatchFailure[] = [];

        // Process in chunks of 10
        for (let i = 0; i < args.recordIds.length; i += 10) {
          const chunkIndex = Math.floor(i / 10);
          const chunk = args.recordIds.slice(i, i + 10);

          try {
            const results = await table.destroy(chunk);
            const resultsArray = Array.isArray(results) ? results : [results];
            succeeded.push(...resultsArray.map((r: any) => ({ id: r.id, deleted: true as const })));
          } catch (chunkError) {
            // Record the failure but continue processing remaining chunks
            failed.push({
              chunkIndex,
              error: chunkError instanceof Error ? chunkError.message : String(chunkError),
              recordIds: chunk,
            });
          }
        }

        const result: BatchDeleteResult = {
          succeeded,
          failed,
          summary: {
            total: args.recordIds.length,
            succeeded: succeeded.length,
            failed: failed.reduce((acc, f) => acc + f.recordIds.length, 0),
          },
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify(formatErrorResponse(error instanceof Error ? error : new Error(String(error))), null, 2);
      }
    },
  });
}
