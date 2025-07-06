import { z } from 'zod';

// Base schemas
const BaseIdSchema = z.string().regex(/^app[a-zA-Z0-9]{14}$/, 'Invalid base ID format');
const TableNameSchema = z.string().min(1).max(255);
const RecordIdSchema = z.string().regex(/^rec[a-zA-Z0-9]{14}$/, 'Invalid record ID format');
const ViewSchema = z.string().min(1);
const FilePathSchema = z.string().min(1);
const Base64Schema = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Invalid base64 format');

// Tool input schemas
export const ListBasesSchema = z.object({});

export const ListTablesSchema = z.object({
  baseId: BaseIdSchema.optional(),
});

export const ListViewsSchema = z.object({
  tableName: TableNameSchema,
  baseId: BaseIdSchema.optional(),
});

export const GetRecordsSchema = z.object({
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

export const CreateRecordSchema = z.object({
  tableName: TableNameSchema,
  fields: z.record(z.unknown()),
  baseId: BaseIdSchema.optional(),
  typecast: z.boolean().optional(),
});

export const UpdateRecordSchema = z.object({
  tableName: TableNameSchema,
  recordId: RecordIdSchema,
  fields: z.record(z.unknown()),
  baseId: BaseIdSchema.optional(),
  typecast: z.boolean().optional(),
});

export const DeleteRecordSchema = z.object({
  tableName: TableNameSchema,
  recordId: RecordIdSchema,
  baseId: BaseIdSchema.optional(),
});

export const GetSchemaSchema = z.object({
  baseId: BaseIdSchema.optional(),
});

export const UploadAttachmentSchema = z.object({
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

export const BatchCreateSchema = z.object({
  tableName: TableNameSchema,
  records: z.array(z.object({
    fields: z.record(z.unknown()),
  })).min(1).max(1000), // Allow up to 1000, will be chunked
  baseId: BaseIdSchema.optional(),
  typecast: z.boolean().optional(),
});

export const BatchUpdateSchema = z.object({
  tableName: TableNameSchema,
  records: z.array(z.object({
    id: RecordIdSchema,
    fields: z.record(z.unknown()),
  })).min(1).max(1000),
  baseId: BaseIdSchema.optional(),
  typecast: z.boolean().optional(),
});

export const BatchDeleteSchema = z.object({
  tableName: TableNameSchema,
  recordIds: z.array(RecordIdSchema).min(1).max(1000),
  baseId: BaseIdSchema.optional(),
});

export const BatchUpsertSchema = z.object({
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