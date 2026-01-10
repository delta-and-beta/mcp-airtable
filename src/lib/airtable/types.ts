/**
 * Shared types for Airtable client
 */

// Record types
export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

export interface DeletedRecord {
  id: string;
  deleted: true;
}

// Field choice type for select fields
export interface FieldChoice {
  id?: string;
  name: string;
  color?: string;
}

// Field options type
export interface FieldOptions {
  choices?: FieldChoice[];
  linkedTableId?: string;
  prefersSingleRecordLink?: boolean;
  inverseLinkFieldId?: string;
  symbol?: string;
  precision?: number;
  max?: number;
  icon?: string;
  color?: string;
  dateFormat?: { name: string };
  timeFormat?: { name: string };
  timeZone?: string;
  [key: string]: unknown;  // Allow additional properties
}

// Field types
export interface AirtableField {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: FieldOptions;
}

// Table types
export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: AirtableField[];
  views: AirtableView[];
  description?: string;
}

export interface AirtableView {
  id: string;
  name: string;
  type: string;
}

// Base types
export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
  workspaceId?: string;  // May not be present in list_bases response
}

export interface AirtableWorkspace {
  id: string;
  name: string;
}

// Comment types
export interface CommentAuthor {
  id: string;
  email: string;
  name?: string;
}

export interface AirtableComment {
  id: string;
  author: CommentAuthor;
  text: string;
  createdTime: string;
  lastUpdatedTime?: string;
}

export interface CommentsResponse {
  comments: AirtableComment[];
  offset?: string;
}

// Attachment types
export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
}

export interface AttachmentUploadResult {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

// API error response type
export interface AirtableApiError {
  error?: {
    type?: string;
    message?: string;
  };
}

// Create base options
export interface CreateBaseOptions {
  name: string;
  workspaceId: string;
  tables: Array<{
    name: string;
    description?: string;
    fields: Array<{
      name: string;
      type: string;
      description?: string;
      options?: Record<string, unknown>;
    }>;
  }>;
}

// Create table options
export interface CreateTableOptions {
  name: string;
  description?: string;
  fields: Array<{
    name: string;
    type: string;
    description?: string;
    options?: Record<string, unknown>;
  }>;
}

// Create field options
export interface CreateFieldOptions {
  name: string;
  type: string;
  description?: string;
  options?: Record<string, unknown>;
}

// Update field options
export interface UpdateFieldOptions {
  name?: string;
  description?: string;
}

// Upload attachment options
export interface UploadAttachmentOptions {
  baseId?: string;
  filePath?: string;
  base64Data?: string;
  filename?: string;
  contentType?: string;
}

// List comments options
export interface ListCommentsOptions {
  baseId?: string;
  offset?: string;
  pageSize?: number;
}

// Get records options
export interface GetRecordsOptions {
  baseId?: string;
  filterByFormula?: string;
  maxRecords?: number;
}

// Create/update record options
export interface RecordOptions {
  baseId?: string;
  typecast?: boolean;
}
