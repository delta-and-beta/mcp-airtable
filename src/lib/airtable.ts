/**
 * Airtable client wrapper
 * Re-exports from modular implementation for backward compatibility
 */

export { AirtableClient, fetchWithDetails, guessContentType } from "./airtable/index.js";
export type {
  AirtableRecord,
  AirtableBase,
  AirtableWorkspace,
  AirtableTable,
  AirtableField,
  AirtableView,
  AirtableComment,
  AirtableAttachment,
  CommentsResponse,
  AttachmentUploadResult,
  DeletedRecord,
  CreateBaseOptions,
  CreateTableOptions,
  CreateFieldOptions,
  UpdateFieldOptions,
  UploadAttachmentOptions,
  ListCommentsOptions,
  GetRecordsOptions,
  RecordOptions,
  AirtableApiError,
  CommentAuthor,
  FieldOptions,
  FieldChoice,
} from "./airtable/index.js";
