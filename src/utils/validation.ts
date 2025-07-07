import { z } from 'zod';

// Base schemas
const BaseIdSchema = z.string().regex(/^app[a-zA-Z0-9]{14}$/, 'Invalid base ID format');
const TableNameSchema = z.string().min(1).max(255);
const RecordIdSchema = z.string().regex(/^rec[a-zA-Z0-9]{14}$/, 'Invalid record ID format');
const ViewSchema = z.string().min(1);
const FilePathSchema = z.string().min(1);
const Base64Schema = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Invalid base64 format');

// Common schema for API key fields
const ApiKeySchema = z.object({
  airtableApiKey: z.string().optional(),
  airtableBaseId: z.string().optional(),
});

// Tool input schemas
export const ListBasesSchema = ApiKeySchema.extend({});

export const ListTablesSchema = ApiKeySchema.extend({
  baseId: BaseIdSchema.optional(),
});

export const ListViewsSchema = ApiKeySchema.extend({
  tableName: TableNameSchema,
  baseId: BaseIdSchema.optional(),
});

export const GetRecordsSchema = ApiKeySchema.extend({
  tableName: TableNameSchema,
  baseId: BaseIdSchema.optional(),
  view: ViewSchema.optional(),
  maxRecords: z.number().int().positive().max(100).optional(),
  filterByFormula: z.string().optional(),
  sort: z.array(z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']).optional(),
  })).optional(),
  fields: z.array(z.string()).optional(),
});

export const CreateRecordSchema = ApiKeySchema.extend({
  tableName: TableNameSchema,
  fields: z.record(z.unknown()),
  baseId: BaseIdSchema.optional(),
  typecast: z.boolean().optional(),
});

export const UpdateRecordSchema = ApiKeySchema.extend({
  tableName: TableNameSchema,
  recordId: RecordIdSchema,
  fields: z.record(z.unknown()),
  baseId: BaseIdSchema.optional(),
  typecast: z.boolean().optional(),
});

export const DeleteRecordSchema = ApiKeySchema.extend({
  tableName: TableNameSchema,
  recordId: RecordIdSchema,
  baseId: BaseIdSchema.optional(),
});

export const GetSchemaSchema = ApiKeySchema.extend({
  baseId: BaseIdSchema.optional(),
});

export const UploadAttachmentSchema = ApiKeySchema.extend({
  filePath: FilePathSchema.optional(),
  base64Data: Base64Schema.optional(),
  filename: z.string().min(1).optional(),
  contentType: z.string().optional(),
}).refine(
  (data) => data.filePath || data.base64Data,
  { message: 'Either filePath or base64Data must be provided' }
).refine(
  (data) => !data.base64Data || data.filename,
  { message: 'filename is required when using base64Data' }
);

export const BatchCreateSchema = ApiKeySchema.extend({
  tableName: TableNameSchema,
  records: z.array(z.object({
    fields: z.record(z.unknown()),
  })).min(1).max(1000), // Allow up to 1000, will be chunked
  baseId: BaseIdSchema.optional(),
  typecast: z.boolean().optional(),
});

export const BatchUpdateSchema = ApiKeySchema.extend({
  tableName: TableNameSchema,
  records: z.array(z.object({
    id: RecordIdSchema,
    fields: z.record(z.unknown()),
  })).min(1).max(1000),
  baseId: BaseIdSchema.optional(),
  typecast: z.boolean().optional(),
});

export const BatchDeleteSchema = ApiKeySchema.extend({
  tableName: TableNameSchema,
  recordIds: z.array(RecordIdSchema).min(1).max(1000),
  baseId: BaseIdSchema.optional(),
});

export const BatchUpsertSchema = ApiKeySchema.extend({
  tableName: TableNameSchema,
  records: z.array(z.object({
    fields: z.record(z.unknown()),
    id: RecordIdSchema.optional(),
  })).min(1).max(1000),
  baseId: BaseIdSchema.optional(),
  typecast: z.boolean().optional(),
  upsertFields: z.array(z.string()).optional(),
  detectUpsertFields: z.boolean().optional(),
});

// Field type enum based on Airtable's supported field types
const FieldTypeSchema = z.enum([
  'singleLineText',
  'email',
  'url',
  'multilineText',
  'number',
  'percent',
  'currency',
  'singleSelect',
  'multipleSelects',
  'singleCollaborator',
  'multipleCollaborators',
  'multipleRecordLinks',
  'date',
  'dateTime',
  'phoneNumber',
  'multipleAttachments',
  'checkbox',
  'formula',
  'createdTime',
  'rollup',
  'count',
  'lookup',
  'multipleLookupValues',
  'autoNumber',
  'barcode',
  'rating',
  'richText',
  'duration',
  'lastModifiedTime',
  'button',
  'createdBy',
  'lastModifiedBy',
  'externalSyncSource',
  'aiText'
]);

export const UpdateTableSchema = ApiKeySchema.extend({
  tableIdOrName: z.string().min(1),
  name: TableNameSchema.optional(),
  description: z.string().optional(),
  baseId: BaseIdSchema.optional(),
}).refine(
  (data) => data.name || data.description,
  { message: 'At least one of name or description must be provided' }
);

export const CreateFieldSchema = ApiKeySchema.extend({
  tableIdOrName: z.string().min(1),
  name: z.string().min(1).max(255),
  type: FieldTypeSchema,
  description: z.string().optional(),
  options: z.object({
    // Single/Multiple Select options
    choices: z.array(z.object({
      name: z.string(),
      color: z.string().optional(),
    })).optional(),
    // Number/Currency options
    precision: z.number().int().min(0).max(8).optional(),
    // Currency options
    symbol: z.string().optional(),
    // Date options
    dateFormat: z.object({
      name: z.enum(['local', 'friendly', 'us', 'european', 'iso']),
      format: z.string().optional(),
    }).optional(),
    timeFormat: z.object({
      name: z.enum(['12hour', '24hour']),
      format: z.string().optional(),
    }).optional(),
    timeZone: z.string().optional(),
    // Linked record options
    linkedTableId: z.string().optional(),
    prefersSingleRecordLink: z.boolean().optional(),
    inverseLinkFieldId: z.string().optional(),
    // Checkbox options
    icon: z.enum(['check', 'star', 'heart', 'thumbsUp', 'flag', 'dot']).optional(),
    color: z.enum(['yellowBright', 'orangeBright', 'redBright', 'pinkBright', 'purpleBright', 'blueBright', 'cyanBright', 'tealBright', 'greenBright', 'grayBright']).optional(),
    // Rating options
    max: z.number().int().min(1).max(10).optional(),
    // Duration options
    durationFormat: z.enum(['h:mm', 'h:mm:ss', 'h:mm:ss.S', 'h:mm:ss.SS', 'h:mm:ss.SSS']).optional(),
  }).optional(),
  baseId: BaseIdSchema.optional(),
});

export const UpdateFieldSchema = ApiKeySchema.extend({
  tableIdOrName: z.string().min(1),
  fieldIdOrName: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  baseId: BaseIdSchema.optional(),
}).refine(
  (data) => data.name || data.description,
  { message: 'At least one of name or description must be provided' }
);

export const CreateTableSchema = z.object({
  airtableApiKey: z.string().optional(),
  airtableBaseId: z.string().optional(),
  name: TableNameSchema,
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string().min(1).max(255),
    type: FieldTypeSchema,
    description: z.string().optional(),
    options: z.object({
      // Single/Multiple Select options
      choices: z.array(z.object({
        name: z.string(),
        color: z.string().optional(),
      })).optional(),
      // Number/Currency options
      precision: z.number().int().min(0).max(8).optional(),
      // Currency options
      symbol: z.string().optional(),
      // Percent options
      // Date options
      dateFormat: z.object({
        name: z.enum(['local', 'friendly', 'us', 'european', 'iso']),
        format: z.string().optional(),
      }).optional(),
      timeFormat: z.object({
        name: z.enum(['12hour', '24hour']),
        format: z.string().optional(),
      }).optional(),
      timeZone: z.string().optional(),
      // Linked record options
      linkedTableId: z.string().optional(),
      prefersSingleRecordLink: z.boolean().optional(),
      inverseLinkFieldId: z.string().optional(),
      // Checkbox options
      icon: z.enum(['check', 'star', 'heart', 'thumbsUp', 'flag', 'dot']).optional(),
      color: z.enum(['yellowBright', 'orangeBright', 'redBright', 'pinkBright', 'purpleBright', 'blueBright', 'cyanBright', 'tealBright', 'greenBright', 'grayBright']).optional(),
      // Rating options
      max: z.number().int().min(1).max(10).optional(),
      // Duration options
      durationFormat: z.enum(['h:mm', 'h:mm:ss', 'h:mm:ss.S', 'h:mm:ss.SS', 'h:mm:ss.SSS']).optional(),
    }).optional(),
  })).min(1),
  baseId: BaseIdSchema.optional(),
});

// Validation helper
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
      throw new Error(`Validation error: ${issues.join(', ')}`);
    }
    throw error;
  }
}