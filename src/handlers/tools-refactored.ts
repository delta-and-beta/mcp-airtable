import { AirtableClient } from '../airtable/client.js';
import { S3StorageClient } from '../s3/client.js';
import { config } from '../config/index.js';
import { airtableRateLimiter } from '../utils/rate-limiter-redis.js';
import { AirtableError } from '../utils/errors.js';
import { getOAuthService } from '../services/oauth/index.js';
import {
  validateInput,
  ListBasesSchema,
  ListTablesSchema,
  GetRecordsSchema,
  GetRecordSchema,
  CreateRecordSchema,
  UpdateRecordSchema,
  DeleteRecordSchema,
  GetSchemaSchema,
  UploadAttachmentSchema,
  BatchUpsertSchema,
  CreateTableSchema,
  UpdateTableSchema,
  CreateFieldSchema,
  UpdateFieldSchema,
} from '../utils/validation.js';
import type { FieldSet } from 'airtable';

// Client cache for reusing connections
const clientCache = new Map<string, AirtableClient>();
let s3Client: S3StorageClient | null = null;

interface AuthOptions {
  apiKey?: string;
  oauthToken?: string;
  userId?: string;
  baseId?: string;
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
        console.warn('OAuth token fetch failed, falling back to API key:', error instanceof Error ? error.message : 'Unknown error');
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
function extractAuthOptions(validated: any): AuthOptions {
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
      return await client.listBases();
    });
  },

  list_tables: async (args: unknown) => {
    const validated = validateInput(ListTablesSchema, args);
    await airtableRateLimiter.acquire('global');
    
    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      return await client.listTables(validated.baseId, validated.includeFields);
    });
  },

  create_table: async (args: unknown) => {
    const validated = validateInput(CreateTableSchema, args);
    await airtableRateLimiter.acquire('global');
    
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

  get_records: async (args: unknown) => {
    const validated = validateInput(GetRecordsSchema, args);
    await airtableRateLimiter.acquire('global');
    
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
    
    return withErrorHandling(async () => {
      const client = await getAirtableClient(extractAuthOptions(validated));
      
      // Determine upsert fields
      let fieldsToMergeOn = validated.upsertFields;
      
      if (validated.detectUpsertFields && !fieldsToMergeOn) {
        const { detectUpsertFields } = await import('../utils/upsert-detection.js');
        
        // Get table schema for better detection
        let tableSchema;
        try {
          const schema = await client.getSchema(validated.baseId || validated.airtableBaseId) as any;
          tableSchema = schema.tables?.find((t: any) => t.name === validated.tableName);
        } catch (error) {
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
      const options: any = {
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
} as const;

// Type-safe tool handler type
export type ToolHandler = typeof toolHandlers[keyof typeof toolHandlers];

// Export tool definitions (keep existing definitions)
export { toolDefinitions } from './tools.js';