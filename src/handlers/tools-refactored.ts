import { AirtableClient } from '../airtable/client.js';
import { S3StorageClient } from '../s3/client.js';
import { config } from '../config/index.js';
import { airtableRateLimiter } from '../utils/rate-limiter-redis.js';
import { AirtableError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getOAuthService } from '../services/oauth/index.js';
import {
  enforceBaseAccess,
  enforceTableAccess,
  enforceViewAccess,
  filterBases,
  filterTables,
} from '../utils/access-control.js';
import {
  validateInput,
  ListBasesSchema,
  ListTablesSchema,
  ListViewsSchema,
  GetRecordsSchema,
  GetRecordSchema,
  CreateRecordSchema,
  UpdateRecordSchema,
  DeleteRecordSchema,
  GetSchemaSchema,
  UploadAttachmentSchema,
  UploadAttachmentDirectSchema,
  BatchUpsertSchema,
  BatchDeleteSchema,
  CreateTableSchema,
  UpdateTableSchema,
  CreateFieldSchema,
  UpdateFieldSchema,
} from '../utils/validation.js';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import type { FieldSet } from 'airtable';

// Client cache for reusing connections
const clientCache = new Map<string, AirtableClient>();
let s3Client: S3StorageClient | null = null;

// Type definitions for handler inputs
interface AuthOptions {
  apiKey?: string;
  oauthToken?: string;
  userId?: string;
  baseId?: string;
}

interface ValidatedAuthInput {
  airtableApiKey?: string;
  oauthToken?: string;
  userId?: string;
  airtableBaseId?: string;
}

interface TableSchema {
  id: string;
  name: string;
  fields?: Array<{ id: string; name: string; type: string }>;
}

interface BatchUpsertOptions {
  baseId?: string;
  typecast?: boolean;
  performUpsert?: {
    fieldsToMergeOn: string[];
  };
}

async function getAirtableClient(options: AuthOptions): Promise<AirtableClient> {
  // Handle OAuth token
  if (options.oauthToken) {
    const cacheKey = `oauth:${options.oauthToken}`;
    if (!clientCache.has(cacheKey)) {
      clientCache.set(cacheKey, new AirtableClient({
        accessToken: options.oauthToken,
        baseId: options.baseId || config.AIRTABLE_BASE_ID,
      }));
    }
    return clientCache.get(cacheKey)!;
  }
  
  // Handle OAuth with userId (auto-fetch token)
  if (options.userId && config.AIRTABLE_OAUTH_ENABLED) {
    const oauthService = getOAuthService();
    if (oauthService) {
      try {
        const accessToken = await oauthService.getValidAccessToken(options.userId);
        const cacheKey = `oauth:${accessToken}`;
        if (!clientCache.has(cacheKey)) {
          clientCache.set(cacheKey, new AirtableClient({
            accessToken,
            baseId: options.baseId || config.AIRTABLE_BASE_ID,
          }));
        }
        return clientCache.get(cacheKey)!;
      } catch (error) {
        // Fall through to API key if OAuth fails
        logger.warn('OAuth token fetch failed, falling back to API key', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }
  
  // Handle API key
  const key = options.apiKey || config.AIRTABLE_API_KEY || '';
  if (!key) {
    throw new Error('Airtable authentication required. Provide apiKey, oauthToken, or userId parameter.');
  }
  
  const cacheKey = `apikey:${key}`;
  if (!clientCache.has(cacheKey)) {
    clientCache.set(cacheKey, new AirtableClient({
      apiKey: key,
      baseId: options.baseId || config.AIRTABLE_BASE_ID,
    }));
  }
  
  return clientCache.get(cacheKey)!;
}

function getS3Client(): S3StorageClient {
  if (!s3Client) {
    if (!config.AWS_S3_BUCKET) {
      throw new Error('S3 is not configured. Please set AWS_S3_BUCKET environment variable.');
    }
    
    s3Client = new S3StorageClient({
      region: config.AWS_REGION,
      bucketName: config.AWS_S3_BUCKET,
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      publicUrlPrefix: config.AWS_S3_PUBLIC_URL_PREFIX,
    });
  }
  return s3Client;
}

// Extract auth options from validated input
function extractAuthOptions(validated: ValidatedAuthInput): AuthOptions {
  return {
    apiKey: validated.airtableApiKey,
    oauthToken: validated.oauthToken,
    userId: validated.userId,
    baseId: validated.airtableBaseId,
  };
}

// Wrap async operations with proper error handling
async function withErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (error instanceof Error) {
      // Check for Airtable-specific errors
      if ('statusCode' in error) {
        throw new AirtableError(
          error.message,
          (error as any).statusCode,
          'AIRTABLE_API_ERROR'
        );
      }
    }
    throw error;
  }
}

// Tool handlers with proper typing
export const toolHandlers = {
  list_bases: async (args: unknown) => {
    const validated = validateInput(ListBasesSchema, args);
    await airtableRateLimiter.acquire('global');

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      const result = await client.listBases() as { bases?: Array<{ id: string; name: string }> };
      // Filter bases based on access control
      return { bases: filterBases(result.bases || []) };
    });
  },

  list_tables: async (args: unknown) => {
    const validated = validateInput(ListTablesSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce base access if baseId provided
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      const result = await client.listTables(validated.baseId, validated.includeFields) as { tables?: Array<{ id: string; name: string }> };
      // Filter tables based on access control
      return { tables: filterTables(result.tables || []) };
    });
  },

  create_table: async (args: unknown) => {
    const validated = validateInput(CreateTableSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce base access
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    // Check if new table name is allowed
    enforceTableAccess(validated.name);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.createTable(
        validated.name,
        validated.fields,
        {
          baseId: validated.baseId,
          description: validated.description,
        }
      );
    });
  },

  update_table: async (args: unknown) => {
    const validated = validateInput(UpdateTableSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce base and table access
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableIdOrName);
    // If renaming, check new name is allowed
    if (validated.name) {
      enforceTableAccess(validated.name);
    }

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.updateTable(
        validated.tableIdOrName,
        {
          name: validated.name,
          description: validated.description,
        },
        {
          baseId: validated.baseId,
        }
      );
    });
  },

  create_field: async (args: unknown) => {
    const validated = validateInput(CreateFieldSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce base and table access
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableIdOrName);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.createField(
        validated.tableIdOrName,
        {
          name: validated.name,
          type: validated.type,
          description: validated.description,
          options: validated.options,
        },
        {
          baseId: validated.baseId,
        }
      );
    });
  },

  update_field: async (args: unknown) => {
    const validated = validateInput(UpdateFieldSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce base and table access
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableIdOrName);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.updateField(
        validated.tableIdOrName,
        validated.fieldIdOrName,
        {
          name: validated.name,
          description: validated.description,
        },
        {
          baseId: validated.baseId,
        }
      );
    });
  },

  list_views: async (args: unknown) => {
    const validated = validateInput(ListViewsSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce access control
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableName);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.listViews(validated.tableName, validated.baseId);
    });
  },

  get_records: async (args: unknown) => {
    const validated = validateInput(GetRecordsSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce access control
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableName);
    if (validated.view) {
      enforceViewAccess(validated.view);
    }

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.getRecords(validated.tableName, {
        baseId: validated.baseId,
        view: validated.view,
        maxRecords: validated.maxRecords,
        filterByFormula: validated.filterByFormula,
        sort: validated.sort,
        fields: validated.fields,
      });
    });
  },

  get_record: async (args: unknown) => {
    const validated = validateInput(GetRecordSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce access control
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableName);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.getRecord(
        validated.tableName,
        validated.recordId,
        { baseId: validated.baseId }
      );
    });
  },

  create_record: async (args: unknown) => {
    const validated = validateInput(CreateRecordSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce access control
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableName);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.createRecord(
        validated.tableName,
        validated.fields as FieldSet,
        { baseId: validated.baseId, typecast: validated.typecast }
      );
    });
  },

  update_record: async (args: unknown) => {
    const validated = validateInput(UpdateRecordSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce access control
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableName);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.updateRecord(
        validated.tableName,
        validated.recordId,
        validated.fields as FieldSet,
        { baseId: validated.baseId, typecast: validated.typecast }
      );
    });
  },

  delete_record: async (args: unknown) => {
    const validated = validateInput(DeleteRecordSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce access control
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableName);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.deleteRecord(
        validated.tableName,
        validated.recordId,
        { baseId: validated.baseId }
      );
    });
  },

  get_schema: async (args: unknown) => {
    const validated = validateInput(GetSchemaSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce base access
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.getSchema(validated.baseId);
    });
  },

  upload_attachment: async (args: unknown) => {
    const validated = validateInput(UploadAttachmentSchema, args);
    
    return withErrorHandling(async () => {
      const s3 = getS3Client();
      
      if (validated.filePath) {
        const result = await s3.uploadFile(validated.filePath, {
          contentType: validated.contentType,
        });
        
        return {
          url: result.url,
          filename: validated.filename || result.key.split('/').pop() || 'unknown',
          size: result.size,
          type: result.contentType,
        };
      } else if (validated.base64Data && validated.filename) {
        const buffer = Buffer.from(validated.base64Data, 'base64');
        const key = `attachments/${Date.now()}-${validated.filename}`;
        
        const result = await s3.uploadBuffer(buffer, {
          key,
          contentType: validated.contentType,
        });
        
        return {
          url: result.url,
          filename: validated.filename,
          size: result.size,
          type: result.contentType,
        };
      }
      
      throw new Error('Invalid upload parameters');
    });
  },

  batch_upsert: async (args: unknown) => {
    const validated = validateInput(BatchUpsertSchema, args);

    // Enforce access control
    const baseId = validated.baseId || validated.airtableBaseId;
    if (baseId) {
      enforceBaseAccess(baseId);
    }
    enforceTableAccess(validated.tableName);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));

      // Determine upsert fields
      let fieldsToMergeOn = validated.upsertFields;
      
      if (validated.detectUpsertFields && !fieldsToMergeOn) {
        const { detectUpsertFields } = await import('../utils/upsert-detection.js');
        
        // Get table schema for better detection
        let tableSchema: TableSchema | undefined;
        try {
          const schema = await client.getSchema(validated.baseId || validated.airtableBaseId) as { tables?: TableSchema[] };
          tableSchema = schema.tables?.find((t: TableSchema) => t.name === validated.tableName);
        } catch {
          // Schema fetch is optional
        }

        fieldsToMergeOn = detectUpsertFields(validated.records, tableSchema);
        
        if (fieldsToMergeOn.length === 0) {
          // If no suitable upsert fields found, fall back to regular batch create
          // by not setting fieldsToMergeOn (it will remain undefined)
          fieldsToMergeOn = undefined;
        }
      }

      // Apply rate limiting per chunk
      const chunks = [];
      for (let i = 0; i < validated.records.length; i += 10) {
        chunks.push(validated.records.slice(i, i + 10));
      }
      
      for (const _chunk of chunks) {
        await airtableRateLimiter.acquire('global');
      }

      // Perform batch upsert
      const options: BatchUpsertOptions = {
        baseId: validated.baseId || validated.airtableBaseId,
        typecast: validated.typecast,
      };

      if (fieldsToMergeOn && fieldsToMergeOn.length > 0) {
        options.performUpsert = {
          fieldsToMergeOn,
        };
      }
      
      return await client.batchUpsert(
        validated.tableName,
        validated.records as Array<{ fields: FieldSet; id?: string }>,
        options
      );
    });
  },

  batch_delete: async (args: unknown) => {
    const validated = validateInput(BatchDeleteSchema, args);

    // Enforce access control
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }
    enforceTableAccess(validated.tableName);

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));

      // Apply rate limiting per chunk (10 records per API call)
      const chunks = [];
      for (let i = 0; i < validated.recordIds.length; i += 10) {
        chunks.push(validated.recordIds.slice(i, i + 10));
      }

      for (const _chunk of chunks) {
        await airtableRateLimiter.acquire('global');
      }

      return await client.batchDelete(validated.tableName, validated.recordIds, {
        baseId: validated.baseId,
      });
    });
  },

  upload_attachment_direct: async (args: unknown) => {
    const validated = validateInput(UploadAttachmentDirectSchema, args);
    await airtableRateLimiter.acquire('global');

    // Enforce access control
    if (validated.baseId) {
      enforceBaseAccess(validated.baseId);
    }

    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));

      let content: Buffer;
      let filename: string;

      if (validated.filePath) {
        // Read file from disk
        content = await readFile(validated.filePath);
        filename = validated.filename || basename(validated.filePath);
      } else if (validated.base64Data && validated.filename) {
        // Decode base64 data
        content = Buffer.from(validated.base64Data, 'base64');
        filename = validated.filename;
      } else {
        throw new Error('Either filePath or (base64Data + filename) must be provided');
      }

      return await client.uploadAttachment(
        validated.recordId,
        validated.fieldIdOrName,
        content,
        {
          filename,
          contentType: validated.contentType,
          baseId: validated.baseId,
        }
      );
    });
  },
} as const;

// Type-safe tool handler type
export type ToolHandler = typeof toolHandlers[keyof typeof toolHandlers];

// Re-export tool definitions from the canonical source
export { toolDefinitions } from '../tools/definitions.js';