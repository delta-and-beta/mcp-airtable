import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool definitions for the MCP Airtable server.
 * These definitions describe the available tools and their input schemas.
 */
export const toolDefinitions: Tool[] = [
  {
    name: 'list_bases',
    description: `List all available Airtable bases accessible with the current API key.

USAGE: Call this first to discover available bases and get their IDs.

RETURNS: Array of bases with 'id' (e.g., "appXXXXXXXXXXXXXX") and 'name' properties.

EXAMPLE RESPONSE:
{
  "bases": [
    { "id": "appABC123def456", "name": "My Project" },
    { "id": "appXYZ789ghi012", "name": "Sales Data" }
  ]
}`,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'list_tables',
    description: `List all tables in an Airtable base.

USAGE: Call this after list_bases to discover tables in a specific base.

RETURNS: Array of tables with 'id' (e.g., "tblXXXXXXXXXXXXXX"), 'name', and optionally 'fields'.

WORKFLOW:
1. First call list_bases to get baseId
2. Then call list_tables with that baseId

EXAMPLE:
{ "baseId": "appABC123def456", "includeFields": true }`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app", e.g., "appABC123def456"). Get this from list_bases.',
        },
        includeFields: {
          type: 'boolean',
          description: 'Set to true to include field definitions (name, type, options) for each table. Default: false to reduce response size.',
          default: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_table',
    description: `Create a new table in an Airtable base.

REQUIRED: At least one field must be provided. The first field becomes the primary field.

COMMON FIELD TYPES:
- singleLineText: Short text (default for primary field)
- multilineText: Long text with line breaks
- number: Numeric values
- singleSelect: Dropdown with predefined choices
- multipleSelects: Multiple choice selection
- date: Date without time
- dateTime: Date with time
- checkbox: Boolean true/false
- multipleAttachments: File attachments
- email, url, phoneNumber: Validated text formats

EXAMPLE:
{
  "baseId": "appABC123def456",
  "name": "Tasks",
  "fields": [
    { "name": "Task Name", "type": "singleLineText" },
    { "name": "Status", "type": "singleSelect", "options": { "choices": [{"name": "Todo"}, {"name": "Done"}] } },
    { "name": "Due Date", "type": "date" }
  ]
}`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        name: {
          type: 'string',
          description: 'Name of the table to create (1-255 characters).',
        },
        description: {
          type: 'string',
          description: 'Optional description of the table.',
        },
        fields: {
          type: 'array',
          description: 'Array of field definitions. First field becomes the primary field.',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Field name (must be unique within table).',
              },
              type: {
                type: 'string',
                description: 'Field type. Common types: singleLineText, number, singleSelect, date, checkbox.',
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
                description: 'Optional field description.',
              },
              options: {
                type: 'object',
                description: 'Field-specific options. Required for singleSelect/multipleSelects (choices), currency (symbol), etc.',
                additionalProperties: true,
              },
            },
            required: ['name', 'type'],
            additionalProperties: false,
          },
          minItems: 1,
        },
      },
      required: ['name', 'fields', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_table',
    description: `Update a table's name or description.

NOTE: Cannot change field types or structure - use create_field/update_field for that.

EXAMPLE:
{ "baseId": "appABC123", "tableIdOrName": "Tasks", "name": "Project Tasks", "description": "All project-related tasks" }`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableIdOrName: {
          type: 'string',
          description: 'Table ID (starts with "tbl") OR the exact table name.',
        },
        name: {
          type: 'string',
          description: 'New name for the table. Omit to keep current name.',
        },
        description: {
          type: 'string',
          description: 'New description. Omit to keep current description.',
        },
      },
      required: ['tableIdOrName', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_field',
    description: `Create a new field (column) in an existing table.

IMPORTANT: Some field types require specific options:
- singleSelect/multipleSelects: Requires "choices" array
- currency: Requires "symbol" (e.g., "$")
- number/percent/currency: Optional "precision" (0-8 decimal places)
- multipleRecordLinks: Requires "linkedTableId"

EXAMPLE - Select field:
{
  "baseId": "appABC123",
  "tableIdOrName": "Tasks",
  "name": "Priority",
  "type": "singleSelect",
  "options": {
    "choices": [
      { "name": "High", "color": "redBright" },
      { "name": "Medium", "color": "yellowBright" },
      { "name": "Low", "color": "greenBright" }
    ]
  }
}`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableIdOrName: {
          type: 'string',
          description: 'Table ID (starts with "tbl") OR exact table name.',
        },
        name: {
          type: 'string',
          description: 'Name for the new field (must be unique in the table).',
        },
        type: {
          type: 'string',
          description: 'Field type.',
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
          description: 'Optional field description.',
        },
        options: {
          type: 'object',
          description: 'Field-type-specific options. See tool description for required options per type.',
          additionalProperties: true,
        },
      },
      required: ['tableIdOrName', 'name', 'type', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_field',
    description: `Update a field's name or description. Cannot change field type.

EXAMPLE:
{ "baseId": "appABC123", "tableIdOrName": "Tasks", "fieldIdOrName": "Status", "name": "Task Status" }`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableIdOrName: {
          type: 'string',
          description: 'Table ID (starts with "tbl") OR exact table name.',
        },
        fieldIdOrName: {
          type: 'string',
          description: 'Field ID (starts with "fld") OR exact field name.',
        },
        name: {
          type: 'string',
          description: 'New name for the field.',
        },
        description: {
          type: 'string',
          description: 'New description for the field.',
        },
      },
      required: ['tableIdOrName', 'fieldIdOrName', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_views',
    description: `List all views in a table. Views are saved filters/sorts in Airtable.

RETURNS: Array of views with 'id' (e.g., "viwXXXXXXXXXXXXXX"), 'name', and 'type'.

EXAMPLE:
{ "baseId": "appABC123", "tableName": "Tasks" }`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableName: {
          type: 'string',
          description: 'Table name OR table ID (starts with "tbl").',
        },
      },
      required: ['tableName', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_records',
    description: `Retrieve records from a table with optional filtering and sorting.

COMMON FILTERS (filterByFormula):
- Exact match: {Field Name} = "value"
- Contains: FIND("search", {Field Name}) > 0
- Empty check: {Field Name} = BLANK()
- Not empty: {Field Name} != BLANK()
- Multiple conditions: AND({Status} = "Active", {Priority} = "High")
- Date comparison: IS_AFTER({Due Date}, TODAY())

IMPORTANT:
- Field names with spaces MUST be wrapped in curly braces: {Field Name}
- String values must be in double quotes: "value"
- Returns max 100 records by default, use maxRecords to change (max 1000)

EXAMPLE - Get active high-priority tasks:
{
  "baseId": "appABC123",
  "tableName": "Tasks",
  "filterByFormula": "AND({Status} = \"Active\", {Priority} = \"High\")",
  "sort": [{ "field": "Due Date", "direction": "asc" }],
  "maxRecords": 50
}`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableName: {
          type: 'string',
          description: 'Exact table name (case-sensitive) OR table ID.',
        },
        view: {
          type: 'string',
          description: 'View name or ID to use. Applies that view\'s filters/sorts first.',
        },
        maxRecords: {
          type: 'number',
          description: 'Maximum records to return. Default: 100, Max: 1000.',
          minimum: 1,
          maximum: 1000,
        },
        filterByFormula: {
          type: 'string',
          description: 'Airtable formula to filter records. Wrap field names in {}, strings in double quotes.',
        },
        sort: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                description: 'Exact field name to sort by.',
              },
              direction: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Sort direction. Default: asc.',
              },
            },
            required: ['field'],
            additionalProperties: false,
          },
          description: 'Sort order. First item is primary sort.',
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only return these fields. Reduces response size.',
        },
      },
      required: ['tableName', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_record',
    description: `Get a single record by its ID.

WHEN TO USE: When you have a specific record ID (e.g., from a previous query or webhook).

RETURNS: Record object with 'id', 'fields', and 'createdTime'.

EXAMPLE:
{ "baseId": "appABC123", "tableName": "Tasks", "recordId": "recXYZ789abc012" }`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableName: {
          type: 'string',
          description: 'Exact table name OR table ID.',
        },
        recordId: {
          type: 'string',
          description: 'The record ID (starts with "rec", e.g., "recABC123xyz456").',
        },
      },
      required: ['tableName', 'recordId', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_record',
    description: `Create a new record in a table.

IMPORTANT:
- Field names must match exactly (case-sensitive)
- Use list_tables with includeFields=true to see available fields
- Set typecast=true to auto-convert values (e.g., "123" to number 123)

FIELD VALUE FORMATS:
- Text: "string value"
- Number: 123 or 123.45
- Checkbox: true or false
- Date: "2024-01-15" (ISO format)
- Single Select: "Option Name" (must match existing choice)
- Multiple Select: ["Option1", "Option2"]
- Link to records: ["recXXX", "recYYY"] (array of record IDs)
- Attachments: [{"url": "https://..."}] (array with url property)

EXAMPLE:
{
  "baseId": "appABC123",
  "tableName": "Tasks",
  "fields": {
    "Task Name": "Review PR",
    "Status": "Todo",
    "Priority": "High",
    "Due Date": "2024-12-31"
  },
  "typecast": true
}`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableName: {
          type: 'string',
          description: 'Exact table name (case-sensitive).',
        },
        fields: {
          type: 'object',
          description: 'Object with field names as keys and values. Field names are case-sensitive.',
          additionalProperties: true,
        },
        typecast: {
          type: 'boolean',
          description: 'Auto-convert values to match field types. Recommended: true.',
          default: false,
        },
      },
      required: ['tableName', 'fields', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_record',
    description: `Update an existing record. Only specified fields are updated.

IMPORTANT:
- Only include fields you want to change
- To clear a field, set it to null
- Field names must match exactly (case-sensitive)

EXAMPLE - Update status and add notes:
{
  "baseId": "appABC123",
  "tableName": "Tasks",
  "recordId": "recXYZ789",
  "fields": {
    "Status": "Done",
    "Notes": "Completed on time"
  },
  "typecast": true
}`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableName: {
          type: 'string',
          description: 'Exact table name (case-sensitive).',
        },
        recordId: {
          type: 'string',
          description: 'The record ID to update (starts with "rec").',
        },
        fields: {
          type: 'object',
          description: 'Object with field names and new values. Only specified fields are updated.',
          additionalProperties: true,
        },
        typecast: {
          type: 'boolean',
          description: 'Auto-convert values to match field types. Recommended: true.',
          default: false,
        },
      },
      required: ['tableName', 'recordId', 'fields', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_record',
    description: `Permanently delete a record. This cannot be undone.

EXAMPLE:
{ "baseId": "appABC123", "tableName": "Tasks", "recordId": "recXYZ789" }`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableName: {
          type: 'string',
          description: 'Table name OR table ID.',
        },
        recordId: {
          type: 'string',
          description: 'The record ID to delete (starts with "rec").',
        },
      },
      required: ['tableName', 'recordId', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_schema',
    description: `Get the complete schema of a base including all tables, fields, and views.

USE FOR: Understanding the structure before creating/updating records.

RETURNS: Complete base metadata with tables, fields (with types and options), and views.

EXAMPLE:
{ "baseId": "appABC123def456" }`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required for schema lookup.',
        },
      },
      required: ['baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'upload_attachment',
    description: `Upload a file to cloud storage (S3/GCS) and get a URL for use in Airtable attachment fields.

REQUIRES: S3 or GCS storage configured on the server.

WORKFLOW:
1. Upload file with this tool to get a URL
2. Use create_record or update_record with the URL in an attachment field:
   { "Attachments": [{ "url": "https://..." }] }

PROVIDE ONE OF:
- filePath: Local file path (server must have access)
- base64Data + filename: Base64-encoded file content

EXAMPLE with base64:
{
  "base64Data": "SGVsbG8gV29ybGQ=",
  "filename": "hello.txt",
  "contentType": "text/plain"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Local file path to upload. Server must have read access.',
        },
        base64Data: {
          type: 'string',
          description: 'Base64-encoded file content. Use with filename.',
        },
        filename: {
          type: 'string',
          description: 'Filename for the attachment. REQUIRED when using base64Data.',
        },
        contentType: {
          type: 'string',
          description: 'MIME type (e.g., "image/png", "application/pdf"). Auto-detected if not provided.',
        },
        storageProvider: {
          type: 'string',
          enum: ['s3', 'gcs'],
          description: 'Storage provider. Uses server default if not specified.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'batch_upsert',
    description: `Create or update multiple records in one operation. Efficiently handles up to 1000 records.

UPSERT BEHAVIOR:
- If upsertFields specified: Updates records where those fields match, creates if no match
- If no upsertFields: Creates all records as new

EXAMPLE - Upsert by email:
{
  "baseId": "appABC123",
  "tableName": "Contacts",
  "records": [
    { "fields": { "Email": "john@example.com", "Name": "John Doe", "Status": "Active" } },
    { "fields": { "Email": "jane@example.com", "Name": "Jane Doe", "Status": "Active" } }
  ],
  "upsertFields": ["Email"],
  "typecast": true
}

This will update existing contacts with matching emails, or create new ones.`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableName: {
          type: 'string',
          description: 'Exact table name (case-sensitive).',
        },
        records: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Record ID for explicit updates. Usually omit for upsert.',
              },
              fields: {
                type: 'object',
                description: 'Field values for this record.',
                additionalProperties: true,
              },
            },
            required: ['fields'],
            additionalProperties: false,
          },
          description: 'Array of records. Max 1000 per call.',
          minItems: 1,
          maxItems: 1000,
        },
        upsertFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Field names to match existing records. E.g., ["Email"] to match by email.',
        },
        detectUpsertFields: {
          type: 'boolean',
          description: 'Auto-detect unique fields for matching. Set true if unsure which fields to use.',
          default: false,
        },
        typecast: {
          type: 'boolean',
          description: 'Auto-convert values. Recommended: true.',
          default: false,
        },
      },
      required: ['tableName', 'records', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'batch_delete',
    description: `Delete multiple records in one operation. This cannot be undone.

EXAMPLE:
{
  "baseId": "appABC123",
  "tableName": "Tasks",
  "recordIds": ["recXYZ789", "recABC123", "recDEF456"]
}`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        tableName: {
          type: 'string',
          description: 'Table name OR table ID.',
        },
        recordIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of record IDs to delete. Each starts with "rec".',
          minItems: 1,
          maxItems: 1000,
        },
      },
      required: ['tableName', 'recordIds', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'upload_attachment_direct',
    description: `Upload a file directly to an Airtable attachment field without needing external storage (S3/GCS).

REQUIREMENTS:
- The record MUST already exist (use create_record first if needed)
- The field MUST be an attachment type field

WORKFLOW:
1. Create or identify the target record (get its recordId)
2. Call this tool with the recordId, field name, and file content
3. The file is uploaded directly to Airtable's storage

PROVIDE ONE OF:
- filePath: Local file path (server must have access)
- base64Data + filename: Base64-encoded file content

EXAMPLE:
{
  "baseId": "appABC123",
  "recordId": "recXYZ789",
  "fieldIdOrName": "Attachments",
  "base64Data": "SGVsbG8gV29ybGQ=",
  "filename": "document.txt"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The base ID (starts with "app"). Required.',
        },
        recordId: {
          type: 'string',
          description: 'The record ID to attach file to (starts with "rec"). Record MUST exist.',
        },
        fieldIdOrName: {
          type: 'string',
          description: 'Attachment field name (exact, case-sensitive) OR field ID (starts with "fld").',
        },
        filePath: {
          type: 'string',
          description: 'Local file path to upload.',
        },
        base64Data: {
          type: 'string',
          description: 'Base64-encoded file content. Use with filename.',
        },
        filename: {
          type: 'string',
          description: 'Filename for the attachment. REQUIRED when using base64Data.',
        },
        contentType: {
          type: 'string',
          description: 'MIME type. Auto-detected from filename if not provided.',
        },
      },
      required: ['recordId', 'fieldIdOrName', 'baseId'],
      additionalProperties: false,
    },
  },
];
