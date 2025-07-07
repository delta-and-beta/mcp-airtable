import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AirtableClient } from '../airtable/client.js';
import { QueuedAirtableClient } from '../airtable/queued-client.js';
import { S3StorageClient } from '../s3/client.js';
import { GCSStorageClient } from '../gcs/client.js';
import { logger } from '../utils/logger.js';
import { validateFilePath, sanitizeFilename } from '../utils/path-validation.js';
import { 
  enforceBaseAccess, 
  enforceTableAccess, 
  enforceViewAccess,
  filterBases,
  filterTables,
  filterViews 
} from '../utils/access-control.js';

let client: AirtableClient | null = null;
let queuedClient: QueuedAirtableClient | null = null;
let s3Client: S3StorageClient | null = null;
let gcsClient: GCSStorageClient | null = null;

function getClient(): AirtableClient {
  if (!client) {
    client = new AirtableClient({
      apiKey: process.env.AIRTABLE_API_KEY || '',
      baseId: process.env.AIRTABLE_BASE_ID,
    });
  }
  return client;
}

function getQueuedClient(): QueuedAirtableClient {
  if (!queuedClient) {
    queuedClient = new QueuedAirtableClient({
      apiKey: process.env.AIRTABLE_API_KEY || '',
      baseId: process.env.AIRTABLE_BASE_ID,
      useQueue: !!process.env.REDIS_URL || !!process.env.REDIS_HOST,
    });
  }
  return queuedClient;
}

function getS3Client(): S3StorageClient | null {
  if (!s3Client && process.env.AWS_S3_BUCKET) {
    try {
      s3Client = new S3StorageClient({
        region: process.env.AWS_REGION || 'us-east-1',
        bucketName: process.env.AWS_S3_BUCKET,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        publicUrlPrefix: process.env.AWS_S3_PUBLIC_URL_PREFIX,
      });
    } catch (error) {
      console.error('Failed to initialize S3 client:', error);
      return null;
    }
  }
  return s3Client;
}

function getGCSClient(): GCSStorageClient | null {
  if (!gcsClient && process.env.GCS_BUCKET) {
    try {
      const config: any = {
        bucketName: process.env.GCS_BUCKET,
        projectId: process.env.GCS_PROJECT_ID,
        publicUrlPrefix: process.env.GCS_PUBLIC_URL_PREFIX,
      };
      
      if (process.env.GCS_KEY_FILE) {
        config.keyFilename = process.env.GCS_KEY_FILE;
      } else if (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) {
        config.credentials = {
          client_email: process.env.GCS_CLIENT_EMAIL,
          private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
      }
      
      gcsClient = new GCSStorageClient(config);
    } catch (error) {
      console.error('Failed to initialize GCS client:', error);
      return null;
    }
  }
  return gcsClient;
}

export const toolDefinitions: Tool[] = [
  {
    name: 'list_bases',
    description: 'List all available Airtable bases',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_tables',
    description: 'List all tables in a base',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
    },
  },
  {
    name: 'create_table',
    description: 'Create a new table in a base',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the table to create',
        },
        description: {
          type: 'string',
          description: 'Description of the table (optional)',
        },
        fields: {
          type: 'array',
          description: 'Fields to create in the table',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the field',
              },
              type: {
                type: 'string',
                description: 'Field type (e.g., singleLineText, number, singleSelect, etc.)',
                enum: [
                  'singleLineText', 'email', 'url', 'multilineText', 'number', 
                  'percent', 'currency', 'singleSelect', 'multipleSelects',
                  'singleCollaborator', 'multipleCollaborators', 'multipleRecordLinks',
                  'date', 'dateTime', 'phoneNumber', 'multipleAttachments', 'checkbox',
                  'formula', 'createdTime', 'rollup', 'count', 'lookup',
                  'multipleLookupValues', 'autoNumber', 'barcode', 'rating',
                  'richText', 'duration', 'lastModifiedTime', 'button',
                  'createdBy', 'lastModifiedBy', 'externalSyncSource', 'aiText'
                ],
              },
              description: {
                type: 'string',
                description: 'Description of the field (optional)',
              },
              options: {
                type: 'object',
                description: 'Field-specific options',
                properties: {
                  choices: {
                    type: 'array',
                    description: 'Choices for select fields',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        color: { type: 'string' },
                      },
                      required: ['name'],
                    },
                  },
                  precision: {
                    type: 'integer',
                    description: 'Decimal places for number/currency fields (0-8)',
                  },
                  symbol: {
                    type: 'string',
                    description: 'Currency symbol',
                  },
                  linkedTableId: {
                    type: 'string',
                    description: 'ID of the linked table for linked record fields',
                  },
                  prefersSingleRecordLink: {
                    type: 'boolean',
                    description: 'Whether linked record field allows only one linked record',
                  },
                },
              },
            },
            required: ['name', 'type'],
          },
          minItems: 1,
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['name', 'fields'],
    },
  },
  {
    name: 'list_views',
    description: 'List all views in a table',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name or ID of the table',
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['tableName'],
    },
  },
  {
    name: 'get_records',
    description: 'Get records from a table',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
        view: {
          type: 'string',
          description: 'The name or ID of a view',
        },
        maxRecords: {
          type: 'number',
          description: 'Maximum number of records to return',
        },
        filterByFormula: {
          type: 'string',
          description: 'An Airtable formula to filter records',
        },
        sort: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              direction: { type: 'string', enum: ['asc', 'desc'] },
            },
            required: ['field'],
          },
          description: 'Sort configuration',
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only return specified fields',
        },
      },
      required: ['tableName'],
    },
  },
  {
    name: 'create_record',
    description: 'Create a new record in a table',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        fields: {
          type: 'object',
          description: 'The fields for the new record',
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
        typecast: {
          type: 'boolean',
          description: 'Automatically typecast values to match field types (e.g., string "100" to number 100)',
        },
      },
      required: ['tableName', 'fields'],
    },
  },
  {
    name: 'update_record',
    description: 'Update an existing record',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        recordId: {
          type: 'string',
          description: 'The ID of the record to update',
        },
        fields: {
          type: 'object',
          description: 'The fields to update',
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
        typecast: {
          type: 'boolean',
          description: 'Automatically typecast values to match field types',
        },
      },
      required: ['tableName', 'recordId', 'fields'],
    },
  },
  {
    name: 'delete_record',
    description: 'Delete a record',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        recordId: {
          type: 'string',
          description: 'The ID of the record to delete',
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['tableName', 'recordId'],
    },
  },
  {
    name: 'get_schema',
    description: 'Get the schema of a base',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
    },
  },
  {
    name: 'upload_attachment',
    description: 'Upload a file to cloud storage (S3 or GCS) and get a URL for Airtable attachment fields',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The local file path to upload',
        },
        base64Data: {
          type: 'string',
          description: 'Base64 encoded file data (alternative to filePath)',
        },
        filename: {
          type: 'string',
          description: 'Filename for the attachment (required when using base64Data)',
        },
        contentType: {
          type: 'string',
          description: 'MIME type of the file (optional)',
        },
        storage: {
          type: 'string',
          enum: ['auto', 's3', 'gcs'],
          description: 'Storage provider to use (default: auto-detect)',
        },
      },
    },
  },
  {
    name: 'batch_create',
    description: 'Create multiple records efficiently (auto-chunks large batches)',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        records: {
          type: 'array',
          description: 'Array of records to create (up to 1000)',
          items: {
            type: 'object',
            properties: {
              fields: {
                type: 'object',
                description: 'Field values for the record',
              },
            },
            required: ['fields'],
          },
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
        typecast: {
          type: 'boolean',
          description: 'Automatically typecast values to match field types',
        },
      },
      required: ['tableName', 'records'],
    },
  },
  {
    name: 'batch_update',
    description: 'Update multiple records efficiently (auto-chunks large batches)',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        records: {
          type: 'array',
          description: 'Array of records to update (up to 1000)',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Record ID to update',
              },
              fields: {
                type: 'object',
                description: 'Field values to update',
              },
            },
            required: ['id', 'fields'],
          },
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
        typecast: {
          type: 'boolean',
          description: 'Automatically typecast values to match field types',
        },
      },
      required: ['tableName', 'records'],
    },
  },
  {
    name: 'batch_delete',
    description: 'Delete multiple records efficiently (auto-chunks large batches)',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        recordIds: {
          type: 'array',
          description: 'Array of record IDs to delete (up to 1000)',
          items: {
            type: 'string',
          },
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['tableName', 'recordIds'],
    },
  },
  {
    name: 'batch_upsert',
    description: 'Create or update multiple records in a single operation',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        records: {
          type: 'array',
          description: 'Array of records to upsert',
          items: {
            type: 'object',
            properties: {
              fields: {
                type: 'object',
                description: 'Field values for the record',
              },
              id: {
                type: 'string',
                description: 'Optional record ID for updates',
              },
            },
            required: ['fields'],
          },
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
        typecast: {
          type: 'boolean',
          description: 'Automatically typecast values to match field types',
        },
        upsertFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to use for matching existing records (stitching keys)',
        },
        detectUpsertFields: {
          type: 'boolean',
          description: 'Automatically detect unique fields to use for upsert (AI-powered)',
        },
      },
      required: ['tableName', 'records'],
    },
  },
];

type ToolHandler = (args: any) => Promise<any>;

export const toolHandlers: Record<string, ToolHandler> = {
  list_bases: async () => {
    const result = await getClient().listBases() as any;
    // Filter bases based on access control
    if (result.bases) {
      result.bases = filterBases(result.bases);
    }
    return result;
  },

  list_tables: async (args: { baseId?: string }) => {
    // Check base access if baseId provided
    if (args.baseId) {
      enforceBaseAccess(args.baseId);
    }
    const result = await getClient().listTables(args.baseId) as any;
    // Filter tables based on access control
    if (result.tables) {
      result.tables = filterTables(result.tables);
    }
    return result;
  },

  create_table: async (args: {
    name: string;
    description?: string;
    fields: Array<{
      name: string;
      type: string;
      description?: string;
      options?: Record<string, any>;
    }>;
    baseId?: string;
    airtableApiKey?: string;
    airtableBaseId?: string;
  }) => {
    // Check base access
    const baseId = args.baseId || args.airtableBaseId;
    if (baseId) {
      enforceBaseAccess(baseId);
    }
    
    // Check if table creation is allowed
    enforceTableAccess(args.name); // This will check if the table name is allowed
    
    const client = getClient();
    
    return client.createTable(args.name, args.fields, {
      baseId: args.baseId,
      description: args.description,
    });
  },

  update_table: async (args: {
    tableIdOrName: string;
    name?: string;
    description?: string;
    baseId?: string;
  }) => {
    // Check base access
    const baseId = args.baseId;
    if (baseId) {
      enforceBaseAccess(baseId);
    }
    
    // Check table access
    enforceTableAccess(args.tableIdOrName);
    
    // If updating name, check if new name is allowed
    if (args.name) {
      enforceTableAccess(args.name);
    }
    
    const client = getClient();
    
    return client.updateTable(
      args.tableIdOrName,
      {
        name: args.name,
        description: args.description,
      },
      {
        baseId: args.baseId,
      }
    );
  },

  create_field: async (args: {
    tableIdOrName: string;
    name: string;
    type: string;
    description?: string;
    options?: Record<string, any>;
    baseId?: string;
  }) => {
    // Check base access
    const baseId = args.baseId;
    if (baseId) {
      enforceBaseAccess(baseId);
    }
    
    // Check table access
    enforceTableAccess(args.tableIdOrName);
    
    const client = getClient();
    
    return client.createField(
      args.tableIdOrName,
      {
        name: args.name,
        type: args.type,
        description: args.description,
        options: args.options,
      },
      {
        baseId: args.baseId,
      }
    );
  },

  update_field: async (args: {
    tableIdOrName: string;
    fieldIdOrName: string;
    name?: string;
    description?: string;
    baseId?: string;
  }) => {
    // Check base access
    const baseId = args.baseId;
    if (baseId) {
      enforceBaseAccess(baseId);
    }
    
    // Check table access
    enforceTableAccess(args.tableIdOrName);
    
    const client = getClient();
    
    return client.updateField(
      args.tableIdOrName,
      args.fieldIdOrName,
      {
        name: args.name,
        description: args.description,
      },
      {
        baseId: args.baseId,
      }
    );
  },

  list_views: async (args: { tableName: string; baseId?: string; airtableApiKey?: string; airtableBaseId?: string }) => {
    // Check base access if baseId provided
    if (args.baseId) {
      enforceBaseAccess(args.baseId);
    }
    // Check table access
    enforceTableAccess(args.tableName);
    
    const result = await getClient().listViews(args.tableName, args.baseId);
    // Filter views based on access control
    if (result.views) {
      result.views = filterViews(result.views);
    }
    return result;
  },

  get_records: async (args: {
    tableName: string;
    baseId?: string;
    view?: string;
    maxRecords?: number;
    filterByFormula?: string;
    sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
    fields?: string[];
  }) => {
    // Check access control
    if (args.baseId) {
      enforceBaseAccess(args.baseId);
    }
    enforceTableAccess(args.tableName);
    if (args.view) {
      enforceViewAccess(args.view);
    }
    
    // Log filterByFormula if present to help debug encoding issues
    if (args.filterByFormula) {
      logger.debug('FilterByFormula received', { 
        formula: args.filterByFormula,
        length: args.filterByFormula.length,
        hasUnicode: /[\u0080-\uFFFF]/.test(args.filterByFormula)
      });
    }
    
    return getClient().getRecords(args.tableName, {
      baseId: args.baseId,
      view: args.view,
      maxRecords: args.maxRecords,
      filterByFormula: args.filterByFormula,
      sort: args.sort,
      fields: args.fields,
    });
  },

  create_record: async (args: {
    tableName: string;
    fields: Record<string, any>;
    baseId?: string;
    typecast?: boolean;
  }) => {
    // Check access control
    if (args.baseId) {
      enforceBaseAccess(args.baseId);
    }
    enforceTableAccess(args.tableName);
    
    // For single records, use the standard client with rate limiting
    const { airtableRateLimiter } = await import('../utils/rate-limiter-redis.js');
    
    return airtableRateLimiter.executeWithRetry(
      () => getClient().createRecord(args.tableName, args.fields, {
        baseId: args.baseId,
        typecast: args.typecast,
      }),
      { baseId: args.baseId, operation: 'create_record' }
    );
  },

  update_record: async (args: {
    tableName: string;
    recordId: string;
    fields: Record<string, any>;
    baseId?: string;
    typecast?: boolean;
  }) => {
    // For single records, use the standard client with rate limiting
    const { airtableRateLimiter } = await import('../utils/rate-limiter-redis.js');
    
    return airtableRateLimiter.executeWithRetry(
      () => getClient().updateRecord(args.tableName, args.recordId, args.fields, {
        baseId: args.baseId,
        typecast: args.typecast,
      }),
      { baseId: args.baseId, operation: 'update_record' }
    );
  },

  delete_record: async (args: {
    tableName: string;
    recordId: string;
    baseId?: string;
  }) => {
    return getClient().deleteRecord(args.tableName, args.recordId, {
      baseId: args.baseId,
    });
  },

  get_schema: async (args: { baseId?: string }) => {
    return getClient().getSchema(args.baseId);
  },

  upload_attachment: async (args: {
    filePath?: string;
    base64Data?: string;
    filename?: string;
    contentType?: string;
    storage?: 'auto' | 's3' | 'gcs';
  }) => {
    // Determine which storage to use
    const storageType = args.storage || 'auto';
    let storageClient: S3StorageClient | GCSStorageClient | null = null;
    
    if (storageType === 's3' || (storageType === 'auto' && process.env.AWS_S3_BUCKET)) {
      storageClient = getS3Client();
      if (!storageClient && storageType === 's3') {
        throw new Error('S3 client not configured. Please set AWS_S3_BUCKET and AWS credentials.');
      }
    }
    
    if (!storageClient && (storageType === 'gcs' || (storageType === 'auto' && process.env.GCS_BUCKET))) {
      storageClient = getGCSClient();
      if (!storageClient && storageType === 'gcs') {
        throw new Error('GCS client not configured. Please set GCS_BUCKET and GCS credentials.');
      }
    }
    
    if (!storageClient) {
      throw new Error('No storage client configured. Please configure either S3 or GCS.');
    }

    if (!args.filePath && !args.base64Data) {
      throw new Error('Either filePath or base64Data must be provided');
    }

    if (args.base64Data && !args.filename) {
      throw new Error('filename is required when using base64Data');
    }

    let result;
    
    if (args.filePath) {
      // Validate the file path to prevent directory traversal
      if (!validateFilePath(args.filePath)) {
        throw new Error('Invalid file path. Path traversal detected or path is not allowed.');
      }
      
      result = await storageClient.uploadFile(args.filePath, {
        contentType: args.contentType,
      });
    } else if (args.base64Data) {
      const buffer = Buffer.from(args.base64Data, 'base64');
      // Sanitize the filename to prevent directory traversal
      const safeFilename = sanitizeFilename(args.filename!);
      const key = `attachments/${Date.now()}-${safeFilename}`;
      result = await storageClient.uploadBuffer(buffer, {
        key,
        contentType: args.contentType,
      });
    }

    return {
      url: result!.url,
      filename: args.filename || result!.key.split('/').pop(),
      size: result!.size,
      type: result!.contentType,
      storage: storageClient instanceof S3StorageClient ? 's3' : 'gcs',
    };
  },

  batch_create: async (args: {
    tableName: string;
    records: Array<{ fields: Record<string, any> }>;
    baseId?: string;
    typecast?: boolean;
  }) => {
    const client = getQueuedClient();
    
    // QueuedClient handles rate limiting and auto-batching internally
    return client.batchCreate(args.tableName, args.records, {
      baseId: args.baseId,
      typecast: args.typecast,
    });
  },

  batch_update: async (args: {
    tableName: string;
    records: Array<{ id: string; fields: Record<string, any> }>;
    baseId?: string;
    typecast?: boolean;
  }) => {
    const client = getQueuedClient();
    
    // QueuedClient handles rate limiting and auto-batching internally
    return client.batchUpdate(args.tableName, args.records, {
      baseId: args.baseId,
      typecast: args.typecast,
    });
  },

  batch_delete: async (args: {
    tableName: string;
    recordIds: string[];
    baseId?: string;
  }) => {
    const client = getQueuedClient();
    
    // Use enhanced rate limiter
    const { airtableRateLimiter } = await import('../utils/rate-limiter-redis.js');
    
    return airtableRateLimiter.executeWithRetry(
      () => client.batchDelete(args.tableName, args.recordIds, {
        baseId: args.baseId,
      }),
      { baseId: args.baseId, operation: 'batch_delete' }
    );
  },

  batch_upsert: async (args: {
    tableName: string;
    records: Array<{ fields: Record<string, any>; id?: string }>;
    baseId?: string;
    typecast?: boolean;
    upsertFields?: string[];
    detectUpsertFields?: boolean;
  }) => {
    const client = getClient();
    
    // If detectUpsertFields is true, use AI to detect the best fields
    let fieldsToMergeOn = args.upsertFields;
    
    if (args.detectUpsertFields && !fieldsToMergeOn) {
      // Import detection utility dynamically to avoid circular dependencies
      const { detectUpsertFields } = await import('../utils/upsert-detection.js');
      
      // Get table schema for better detection
      let tableSchema;
      try {
        const schema = await client.getSchema(args.baseId) as any;
        tableSchema = schema.tables?.find((t: any) => t.name === args.tableName);
      } catch (error) {
        // Schema fetch is optional, continue without it
      }
      
      fieldsToMergeOn = detectUpsertFields(args.records, tableSchema);
      
      if (fieldsToMergeOn.length === 0) {
        throw new Error('Could not detect suitable upsert fields. Please specify upsertFields manually.');
      }
    }

    // Use enhanced rate limiter
    const { airtableRateLimiter } = await import('../utils/rate-limiter-redis.js');
    
    return airtableRateLimiter.executeWithRetry(
      () => client.batchUpsert(args.tableName, args.records, {
        baseId: args.baseId,
        typecast: args.typecast,
        performUpsert: fieldsToMergeOn ? { fieldsToMergeOn } : undefined,
      }),
      { baseId: args.baseId, operation: 'batch_upsert' }
    );
  },
};