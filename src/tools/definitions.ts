import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool definitions for the MCP Airtable server.
 * These definitions describe the available tools and their input schemas.
 *
 * AUTHENTICATION: All tools require airtableApiKey parameter for authentication.
 * Get your API key from: https://airtable.com/create/tokens
 *
 * ID FORMATS:
 * - Base ID: starts with "app" (17 chars), e.g., "appABC123def456gh"
 * - Table ID: starts with "tbl" (17 chars), e.g., "tblXYZ789abc012de"
 * - Record ID: starts with "rec" (17 chars), e.g., "recMNO345pqr678st"
 * - Field ID: starts with "fld" (17 chars), e.g., "fldUVW901xyz234ab"
 * - View ID: starts with "viw" (17 chars), e.g., "viwGHI567jkl890cd"
 */
export const toolDefinitions: Tool[] = [
  {
    name: 'list_bases',
    description: `List all Airtable bases accessible with the provided API key.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token (starts with "pat")
- Get token from: https://airtable.com/create/tokens

WHEN TO USE: Call this FIRST to discover available bases and get their IDs.

RETURNS:
{
  "bases": [
    { "id": "appABC123def456gh", "name": "My Project", "permissionLevel": "create" }
  ]
}

COMMON ERRORS:
- "Unauthorized": Invalid or expired API key
- "No bases found": API key has no base access - check token scopes

EXAMPLE:
{ "airtableApiKey": "patXXX.XXXXX" }`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token (starts with "pat"). REQUIRED for authentication.',
        },
      },
      required: ['airtableApiKey'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tables',
    description: `List all tables in an Airtable base with their field definitions.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

WORKFLOW:
1. Call list_bases first to get the baseId
2. Call list_tables with that baseId
3. Use table names/IDs for subsequent record operations

PARAMETERS:
- baseId: The base ID (starts with "app") - REQUIRED
- includeFields: Set true to get field definitions (name, type, options)

RETURNS:
{
  "tables": [
    {
      "id": "tblXYZ789abc012de",
      "name": "Tasks",
      "primaryFieldId": "fldABC123",
      "fields": [
        { "id": "fldABC123", "name": "Task Name", "type": "singleLineText" },
        { "id": "fldDEF456", "name": "Status", "type": "singleSelect", "options": {...} }
      ],
      "views": [
        { "id": "viwGHI789", "name": "Grid view", "type": "grid" }
      ]
    }
  ]
}

COMMON ERRORS:
- "Invalid base ID format": baseId must start with "app" and be 17 chars
- "Base not found": Check baseId or API key permissions

EXAMPLE:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "includeFields": true
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app", 17 chars). Get from list_bases. REQUIRED.',
        },
        includeFields: {
          type: 'boolean',
          description: 'Include field definitions for each table. Default: false.',
          default: false,
        },
      },
      required: ['airtableApiKey', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_table',
    description: `Create a new table in an Airtable base.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

REQUIREMENTS:
- At least one field must be provided
- The first field becomes the primary field (usually singleLineText)
- Field names must be unique within the table

COMMON FIELD TYPES:
- singleLineText: Short text (max 100,000 chars)
- multilineText: Long text with line breaks
- number: Numeric values (integer or decimal)
- singleSelect: Dropdown with predefined choices (requires options.choices)
- multipleSelects: Multiple choice selection (requires options.choices)
- date: Date only (YYYY-MM-DD)
- dateTime: Date and time
- checkbox: Boolean true/false
- email: Validated email format
- url: Validated URL format
- phoneNumber: Phone number text
- multipleAttachments: File attachments
- currency: Money values (requires options.symbol)
- percent: Percentage values
- rating: Star rating (1-10)
- multipleRecordLinks: Link to records in another table (requires options.linkedTableId)

FIELD OPTIONS BY TYPE:
- singleSelect/multipleSelects: { "choices": [{"name": "Option1"}, {"name": "Option2"}] }
- currency: { "symbol": "$", "precision": 2 }
- number/percent: { "precision": 2 }
- rating: { "max": 5, "icon": "star" }
- multipleRecordLinks: { "linkedTableId": "tblXXX" }

EXAMPLE:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "name": "Tasks",
  "description": "Project task tracking",
  "fields": [
    { "name": "Task Name", "type": "singleLineText" },
    { "name": "Description", "type": "multilineText" },
    { "name": "Status", "type": "singleSelect", "options": { "choices": [{"name": "Todo"}, {"name": "In Progress"}, {"name": "Done"}] } },
    { "name": "Priority", "type": "singleSelect", "options": { "choices": [{"name": "High", "color": "redBright"}, {"name": "Medium", "color": "yellowBright"}, {"name": "Low", "color": "greenBright"}] } },
    { "name": "Due Date", "type": "date" },
    { "name": "Completed", "type": "checkbox" }
  ]
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        name: {
          type: 'string',
          description: 'Table name (1-255 characters). REQUIRED.',
        },
        description: {
          type: 'string',
          description: 'Optional table description.',
        },
        fields: {
          type: 'array',
          description: 'Array of field definitions. At least one required. First field becomes primary.',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Field name (must be unique within table).',
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
                description: 'Type-specific options. Required for singleSelect, multipleSelects, currency, multipleRecordLinks.',
                additionalProperties: true,
              },
            },
            required: ['name', 'type'],
            additionalProperties: false,
          },
          minItems: 1,
        },
      },
      required: ['airtableApiKey', 'baseId', 'name', 'fields'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_table',
    description: `Update a table's name or description.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

NOTE: This only updates table metadata. To modify fields, use create_field or update_field.

PARAMETERS:
- baseId: Base ID (starts with "app") - REQUIRED
- tableIdOrName: Table ID (starts with "tbl") OR exact table name - REQUIRED
- name: New table name (optional)
- description: New description (optional)

At least one of name or description must be provided.

EXAMPLE:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Tasks",
  "name": "Project Tasks",
  "description": "All tasks for the Q4 project"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableIdOrName: {
          type: 'string',
          description: 'Table ID (starts with "tbl") OR exact table name. REQUIRED.',
        },
        name: {
          type: 'string',
          description: 'New table name.',
        },
        description: {
          type: 'string',
          description: 'New table description.',
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableIdOrName'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_field',
    description: `Add a new field (column) to an existing table.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

FIELD TYPES AND REQUIRED OPTIONS:

No options required:
- singleLineText, multilineText, email, url, phoneNumber
- number, percent, checkbox, date, dateTime
- richText, duration, autoNumber

Options required:
- singleSelect: { "choices": [{"name": "Option1"}, {"name": "Option2", "color": "blueBright"}] }
- multipleSelects: { "choices": [{"name": "Tag1"}, {"name": "Tag2"}] }
- currency: { "symbol": "$", "precision": 2 }
- rating: { "max": 5, "icon": "star" }
- multipleRecordLinks: { "linkedTableId": "tblXXXXXXXXXXXXXXX" }

AVAILABLE COLORS for select choices:
blueLight, cyanLight, tealLight, greenLight, yellowLight, orangeLight, redLight, pinkLight, purpleLight, grayLight,
blueBright, cyanBright, tealBright, greenBright, yellowBright, orangeBright, redBright, pinkBright, purpleBright, grayBright,
blueDark, cyanDark, tealDark, greenDark, yellowDark, orangeDark, redDark, pinkDark, purpleDark, grayDark

EXAMPLE - Create a priority dropdown:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Tasks",
  "name": "Priority",
  "type": "singleSelect",
  "description": "Task priority level",
  "options": {
    "choices": [
      { "name": "Critical", "color": "redBright" },
      { "name": "High", "color": "orangeBright" },
      { "name": "Medium", "color": "yellowBright" },
      { "name": "Low", "color": "greenBright" }
    ]
  }
}

EXAMPLE - Create a currency field:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Invoices",
  "name": "Amount",
  "type": "currency",
  "options": { "symbol": "$", "precision": 2 }
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableIdOrName: {
          type: 'string',
          description: 'Table ID (starts with "tbl") OR exact table name. REQUIRED.',
        },
        name: {
          type: 'string',
          description: 'Field name (must be unique in the table). REQUIRED.',
        },
        type: {
          type: 'string',
          description: 'Field type. REQUIRED.',
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
          description: 'Type-specific options. Required for singleSelect, multipleSelects, currency, rating, multipleRecordLinks.',
          additionalProperties: true,
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableIdOrName', 'name', 'type'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_field',
    description: `Update a field's name or description. Cannot change field type.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

LIMITATIONS:
- Cannot change field type (must delete and recreate)
- Cannot modify primary field name in some cases
- At least one of name or description must be provided

EXAMPLE:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Tasks",
  "fieldIdOrName": "Status",
  "name": "Task Status",
  "description": "Current status of the task"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableIdOrName: {
          type: 'string',
          description: 'Table ID (starts with "tbl") OR exact table name. REQUIRED.',
        },
        fieldIdOrName: {
          type: 'string',
          description: 'Field ID (starts with "fld") OR exact field name. REQUIRED.',
        },
        name: {
          type: 'string',
          description: 'New field name.',
        },
        description: {
          type: 'string',
          description: 'New field description.',
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableIdOrName', 'fieldIdOrName'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_views',
    description: `List all views in a table.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

WHAT ARE VIEWS: Views are saved configurations of filters, sorts, field visibility, and grouping in Airtable.

VIEW TYPES:
- grid: Standard spreadsheet view
- form: Form for data entry
- calendar: Calendar view (requires date field)
- gallery: Card/image gallery view
- kanban: Kanban board view
- timeline: Timeline/Gantt view
- block: Dashboard with apps

RETURNS:
{
  "tableId": "tblXYZ789abc012de",
  "tableName": "Tasks",
  "views": [
    { "id": "viwABC123", "name": "Grid view", "type": "grid" },
    { "id": "viwDEF456", "name": "Active Tasks", "type": "grid" },
    { "id": "viwGHI789", "name": "By Status", "type": "kanban" }
  ]
}

USE CASE: Use view IDs with get_records to apply a view's filters/sorts.

EXAMPLE:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableName: {
          type: 'string',
          description: 'Table name OR table ID (starts with "tbl"). REQUIRED.',
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_records',
    description: `Retrieve records from a table with optional filtering, sorting, and field selection.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

PARAMETERS:
- baseId: Base ID (starts with "app") - REQUIRED
- tableName: Table name or ID - REQUIRED
- filterByFormula: Airtable formula to filter records
- sort: Array of sort specifications
- fields: Array of field names to return (reduces response size)
- view: View name/ID to use its filters and sorts
- maxRecords: Max records to return (default 100, max 1000)

FORMULA SYNTAX (filterByFormula):
Field names with spaces MUST be in curly braces: {Field Name}
String values MUST be in double quotes: "value"
Numbers don't need quotes: 123

FORMULA EXAMPLES:

Exact match:
- {Status} = "Active"
- {Priority} = "High"
- {Count} = 5

Text contains:
- FIND("search", {Name}) > 0
- SEARCH("keyword", LOWER({Description})) > 0

Empty/Not empty:
- {Email} = BLANK()
- {Email} != BLANK()
- OR({Email} = BLANK(), {Email} = "")

Multiple conditions (AND):
- AND({Status} = "Active", {Priority} = "High")
- AND({Status} != "Done", IS_BEFORE({Due Date}, TODAY()))

Multiple conditions (OR):
- OR({Status} = "Active", {Status} = "Pending")
- OR({Priority} = "High", {Priority} = "Critical")

Date comparisons:
- {Due Date} = TODAY()
- IS_BEFORE({Due Date}, TODAY())
- IS_AFTER({Due Date}, DATEADD(TODAY(), 7, 'days'))
- IS_SAME({Created}, TODAY(), 'month')

Numeric comparisons:
- {Amount} > 100
- {Amount} >= 50
- AND({Amount} > 10, {Amount} < 100)

Checkbox:
- {Completed} = TRUE()
- {Completed} = FALSE()

Linked records (check if has links):
- {Assigned To} != BLANK()

RETURNS:
{
  "records": [
    {
      "id": "recXYZ789abc012de",
      "createdTime": "2024-01-15T10:30:00.000Z",
      "fields": {
        "Task Name": "Review PR",
        "Status": "Active",
        "Priority": "High"
      }
    }
  ]
}

EXAMPLE - Get active high-priority tasks sorted by due date:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "filterByFormula": "AND({Status} = \"Active\", {Priority} = \"High\")",
  "sort": [{ "field": "Due Date", "direction": "asc" }],
  "fields": ["Task Name", "Status", "Priority", "Due Date"],
  "maxRecords": 50
}

EXAMPLE - Get overdue incomplete tasks:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "filterByFormula": "AND({Completed} = FALSE(), IS_BEFORE({Due Date}, TODAY()))"
}

EXAMPLE - Search by partial text match:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Contacts",
  "filterByFormula": "FIND(\"john\", LOWER({Name})) > 0"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableName: {
          type: 'string',
          description: 'Exact table name (case-sensitive) OR table ID. REQUIRED.',
        },
        view: {
          type: 'string',
          description: 'View name or ID. Applies that view\'s filters/sorts before any additional filtering.',
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
          description: 'Only return these field names. Reduces response size.',
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_record',
    description: `Get a single record by its ID.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

WHEN TO USE:
- When you have a specific record ID from a previous query
- When you need full record details including all fields

RETURNS:
{
  "id": "recXYZ789abc012de",
  "createdTime": "2024-01-15T10:30:00.000Z",
  "fields": {
    "Task Name": "Review PR",
    "Status": "Active",
    "Priority": "High",
    "Assigned To": ["recABC123..."],
    "Due Date": "2024-12-31"
  }
}

COMMON ERRORS:
- "Record not found": Invalid recordId or record was deleted
- "Invalid record ID format": recordId must start with "rec" and be 17 chars

EXAMPLE:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "recordId": "recXYZ789abc012de"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableName: {
          type: 'string',
          description: 'Table name OR table ID. REQUIRED.',
        },
        recordId: {
          type: 'string',
          description: 'Record ID (starts with "rec", 17 chars). REQUIRED.',
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableName', 'recordId'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_record',
    description: `Create a new record in a table.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

IMPORTANT:
- Field names must match exactly (case-sensitive)
- Use list_tables with includeFields=true to see available fields and types
- Set typecast=true to auto-convert values (recommended)

FIELD VALUE FORMATS BY TYPE:

Text fields (singleLineText, multilineText, email, url, phoneNumber):
- "string value"

Number/Currency/Percent:
- 123 (integer)
- 123.45 (decimal)

Checkbox:
- true or false (boolean, not string)

Date:
- "2024-01-15" (ISO format YYYY-MM-DD)

DateTime:
- "2024-01-15T10:30:00.000Z" (ISO 8601 format)

Single Select:
- "Option Name" (must match existing choice exactly, or use typecast=true to create)

Multiple Select:
- ["Option1", "Option2"] (array of strings)

Link to Records (multipleRecordLinks):
- ["recXXXXXXXXXXXXXXX", "recYYYYYYYYYYYYYYY"] (array of record IDs)

Attachments (multipleAttachments):
- [{"url": "https://example.com/file.pdf"}] (array with url property)
- [{"url": "https://...", "filename": "custom-name.pdf"}] (with custom filename)

Collaborator:
- {"email": "user@example.com"} (object with email)

Rating:
- 3 (integer within rating max, e.g., 1-5)

RETURNS:
{
  "id": "recNEW123abc456de",
  "createdTime": "2024-01-15T10:30:00.000Z",
  "fields": { ...created fields... }
}

EXAMPLE - Create a task:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "fields": {
    "Task Name": "Review quarterly report",
    "Status": "Todo",
    "Priority": "High",
    "Due Date": "2024-12-31",
    "Completed": false,
    "Assigned To": ["recUSR123abc456"]
  },
  "typecast": true
}

EXAMPLE - Create with attachment:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Documents",
  "fields": {
    "Name": "Q4 Report",
    "Files": [{"url": "https://example.com/report.pdf", "filename": "Q4-Report.pdf"}]
  },
  "typecast": true
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableName: {
          type: 'string',
          description: 'Exact table name (case-sensitive). REQUIRED.',
        },
        fields: {
          type: 'object',
          description: 'Object with field names as keys. Field names are case-sensitive. REQUIRED.',
          additionalProperties: true,
        },
        typecast: {
          type: 'boolean',
          description: 'Auto-convert values to match field types. Recommended: true.',
          default: false,
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableName', 'fields'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_record',
    description: `Update an existing record. Only specified fields are modified.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

IMPORTANT:
- Only include fields you want to change
- Unspecified fields remain unchanged
- To clear a field, set it to null
- Field names must match exactly (case-sensitive)

RETURNS:
{
  "id": "recXYZ789abc012de",
  "createdTime": "2024-01-15T10:30:00.000Z",
  "fields": { ...updated fields... }
}

EXAMPLE - Update task status:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "recordId": "recXYZ789abc012de",
  "fields": {
    "Status": "Done",
    "Completed": true,
    "Completed Date": "2024-12-27"
  },
  "typecast": true
}

EXAMPLE - Clear a field:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "recordId": "recXYZ789abc012de",
  "fields": {
    "Assigned To": null
  }
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableName: {
          type: 'string',
          description: 'Exact table name (case-sensitive). REQUIRED.',
        },
        recordId: {
          type: 'string',
          description: 'Record ID to update (starts with "rec"). REQUIRED.',
        },
        fields: {
          type: 'object',
          description: 'Object with field names and new values. Only these fields are updated. REQUIRED.',
          additionalProperties: true,
        },
        typecast: {
          type: 'boolean',
          description: 'Auto-convert values to match field types. Recommended: true.',
          default: false,
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableName', 'recordId', 'fields'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_record',
    description: `Permanently delete a single record.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

WARNING: This action cannot be undone. The record is permanently deleted.

RETURNS:
{
  "id": "recXYZ789abc012de",
  "deleted": true
}

EXAMPLE:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "recordId": "recXYZ789abc012de"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableName: {
          type: 'string',
          description: 'Table name OR table ID. REQUIRED.',
        },
        recordId: {
          type: 'string',
          description: 'Record ID to delete (starts with "rec"). REQUIRED.',
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableName', 'recordId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_schema',
    description: `Get the complete schema of a base including all tables, fields, and views.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

WHEN TO USE:
- Before creating records (to see field names and types)
- To understand the structure of an unfamiliar base
- To find linked table IDs for multipleRecordLinks fields

RETURNS:
{
  "tables": [
    {
      "id": "tblXYZ789abc012de",
      "name": "Tasks",
      "primaryFieldId": "fldABC123...",
      "fields": [
        { "id": "fldABC123", "name": "Task Name", "type": "singleLineText" },
        { "id": "fldDEF456", "name": "Status", "type": "singleSelect", "options": { "choices": [...] } }
      ],
      "views": [
        { "id": "viwGHI789", "name": "Grid view", "type": "grid" }
      ]
    }
  ]
}

EXAMPLE:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
      },
      required: ['airtableApiKey', 'baseId'],
      additionalProperties: false,
    },
  },
  {
    name: 'upload_attachment',
    description: `Upload a file to cloud storage (S3/GCS) and get a URL for use in Airtable attachment fields.

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

PREREQUISITES:
- S3 or GCS storage must be configured on the MCP server
- If not configured, use upload_attachment_direct instead

WORKFLOW:
1. Upload file with this tool to get a public URL
2. Use the URL in create_record or update_record:
   "Attachments": [{"url": "https://your-storage.com/file.pdf"}]

PROVIDE ONE OF:
- filePath: Path to a file the server can read
- base64Data + filename: Base64-encoded file content

COMMON MIME TYPES (contentType):
- Text: "text/plain", "text/csv"
- Images: "image/png", "image/jpeg", "image/gif"
- Documents: "application/pdf", "application/json"

RETURNS:
{
  "url": "https://your-bucket.s3.amazonaws.com/uploads/uuid/filename.pdf",
  "filename": "document.pdf",
  "contentType": "application/pdf",
  "size": 12345
}

EXAMPLE with base64:
{
  "airtableApiKey": "patXXX.XXXXX",
  "base64Data": "JVBERi0xLjQK...",
  "filename": "report.pdf",
  "contentType": "application/pdf"
}

EXAMPLE with file path:
{
  "airtableApiKey": "patXXX.XXXXX",
  "filePath": "/path/to/document.pdf"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        filePath: {
          type: 'string',
          description: 'Local file path. Server must have read access.',
        },
        base64Data: {
          type: 'string',
          description: 'Base64-encoded file content. Use with filename.',
        },
        filename: {
          type: 'string',
          description: 'Filename for the upload. REQUIRED when using base64Data.',
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
      required: ['airtableApiKey'],
      additionalProperties: false,
    },
  },
  {
    name: 'batch_upsert',
    description: `Create or update multiple records in a single operation (up to 1000 records).

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

WHAT IS UPSERT:
- Upsert = Update if exists, Insert (create) if not
- Matching is based on the fields specified in upsertFields
- If a record matches, it's updated; if not, a new record is created

UPSERT LOGIC:
1. If upsertFields specified: Match records by those field values
   - Example: upsertFields: ["Email"] - matches by email address
2. If records have id property: Update those specific records
3. If neither: All records are created as new

PARAMETERS:
- baseId: Base ID (starts with "app") - REQUIRED
- tableName: Table name - REQUIRED
- records: Array of {fields: {...}} objects - REQUIRED
- upsertFields: Field names to match existing records
- detectUpsertFields: Auto-detect unique fields for matching
- typecast: Auto-convert values (recommended: true)

RETURNS:
{
  "records": [
    { "id": "recXYZ...", "fields": {...}, "createdTime": "..." }
  ],
  "updatedRecords": ["recXYZ..."],
  "createdRecords": ["recABC..."]
}

EXAMPLE - Sync contacts by email (update existing, create new):
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Contacts",
  "records": [
    { "fields": { "Email": "john@example.com", "Name": "John Doe", "Company": "Acme Inc" } },
    { "fields": { "Email": "jane@example.com", "Name": "Jane Smith", "Company": "Tech Corp" } },
    { "fields": { "Email": "bob@example.com", "Name": "Bob Wilson", "Company": "StartupXYZ" } }
  ],
  "upsertFields": ["Email"],
  "typecast": true
}

EXAMPLE - Batch create new records (no upsert):
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "records": [
    { "fields": { "Task Name": "Task 1", "Status": "Todo" } },
    { "fields": { "Task Name": "Task 2", "Status": "Todo" } }
  ],
  "typecast": true
}

EXAMPLE - Update specific records by ID:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "records": [
    { "id": "recXYZ789...", "fields": { "Status": "Done" } },
    { "id": "recABC123...", "fields": { "Status": "Done" } }
  ],
  "typecast": true
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableName: {
          type: 'string',
          description: 'Exact table name (case-sensitive). REQUIRED.',
        },
        records: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Record ID for explicit updates. Omit for upsert by field matching.',
              },
              fields: {
                type: 'object',
                description: 'Field values for this record. REQUIRED.',
                additionalProperties: true,
              },
            },
            required: ['fields'],
            additionalProperties: false,
          },
          description: 'Array of records to create/update. Max 1000 per call. REQUIRED.',
          minItems: 1,
          maxItems: 1000,
        },
        upsertFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Field names to match existing records for upsert. E.g., ["Email"] or ["First Name", "Last Name"].',
        },
        detectUpsertFields: {
          type: 'boolean',
          description: 'Auto-detect unique fields (email, URL, phone) for matching. Default: false.',
          default: false,
        },
        typecast: {
          type: 'boolean',
          description: 'Auto-convert values to match field types. Recommended: true.',
          default: false,
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableName', 'records'],
      additionalProperties: false,
    },
  },
  {
    name: 'batch_delete',
    description: `Delete multiple records in a single operation (up to 1000 records).

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

WARNING: This action cannot be undone. Records are permanently deleted.

RETURNS:
{
  "records": [
    { "id": "recXYZ789...", "deleted": true },
    { "id": "recABC123...", "deleted": true }
  ]
}

EXAMPLE:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "tableName": "Tasks",
  "recordIds": [
    "recXYZ789abc012de",
    "recABC123def456gh",
    "recMNO345pqr678st"
  ]
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        tableName: {
          type: 'string',
          description: 'Table name OR table ID. REQUIRED.',
        },
        recordIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of record IDs to delete. Each starts with "rec". Max 1000. REQUIRED.',
          minItems: 1,
          maxItems: 1000,
        },
      },
      required: ['airtableApiKey', 'baseId', 'tableName', 'recordIds'],
      additionalProperties: false,
    },
  },
  {
    name: 'upload_attachment_direct',
    description: `Upload a file directly to an Airtable attachment field (no external storage required).

AUTHENTICATION REQUIRED:
- airtableApiKey: Your Airtable Personal Access Token

ADVANTAGES:
- No S3/GCS configuration needed
- Files stored directly in Airtable
- Simpler workflow than upload_attachment

REQUIREMENTS:
- The target record MUST already exist (create with create_record first)
- The target field MUST be an attachment type field
- You MUST provide contentType for reliable uploads

WORKFLOW:
1. Create the record first (if it doesn't exist): create_record
2. Get the recordId from step 1 (starts with "rec")
3. Call this tool with recordId, field name, file content, AND contentType
4. File is uploaded directly to Airtable's CDN

REQUIRED PARAMETERS:
- airtableApiKey: Your API token
- baseId: Base ID (starts with "app")
- recordId: Existing record ID (starts with "rec")
- fieldIdOrName: Attachment field name or ID
- contentType: MIME type of the file
- ONE OF: filePath OR (base64Data + filename)

COMMON MIME TYPES (contentType) - YOU MUST SPECIFY ONE:
- Plain text: "text/plain"
- CSV: "text/csv"
- HTML: "text/html"
- JSON: "application/json"
- PDF: "application/pdf"
- PNG image: "image/png"
- JPEG image: "image/jpeg"
- GIF image: "image/gif"
- WebP image: "image/webp"
- SVG image: "image/svg+xml"
- Excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
- Word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
- MP3 audio: "audio/mpeg"
- WAV audio: "audio/wav"
- MP4 video: "video/mp4"
- WebM video: "video/webm"
- ZIP archive: "application/zip"

RETURNS:
{
  "success": true,
  "attachment": {
    "id": "attXYZ789...",
    "url": "https://v5.airtableusercontent.com/...",
    "filename": "document.pdf",
    "size": 12345,
    "type": "application/pdf"
  }
}

EXAMPLE - Upload a text file:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "recordId": "recXYZ789abc012de",
  "fieldIdOrName": "Attachments",
  "base64Data": "SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0IGZpbGUu",
  "filename": "hello.txt",
  "contentType": "text/plain"
}

EXAMPLE - Upload a PNG image:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "recordId": "recXYZ789abc012de",
  "fieldIdOrName": "Photos",
  "base64Data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "filename": "pixel.png",
  "contentType": "image/png"
}

EXAMPLE - Upload a PDF document:
{
  "airtableApiKey": "patXXX.XXXXX",
  "baseId": "appABC123def456gh",
  "recordId": "recXYZ789abc012de",
  "fieldIdOrName": "Documents",
  "base64Data": "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC...",
  "filename": "report.pdf",
  "contentType": "application/pdf"
}`,
    inputSchema: {
      type: 'object',
      properties: {
        airtableApiKey: {
          type: 'string',
          description: 'Airtable Personal Access Token. REQUIRED.',
        },
        baseId: {
          type: 'string',
          description: 'Base ID (starts with "app"). REQUIRED.',
        },
        recordId: {
          type: 'string',
          description: 'Record ID to attach file to (starts with "rec"). Record MUST already exist. REQUIRED.',
        },
        fieldIdOrName: {
          type: 'string',
          description: 'Attachment field name (exact, case-sensitive) OR field ID (starts with "fld"). REQUIRED.',
        },
        filePath: {
          type: 'string',
          description: 'Local file path to upload. Server must have read access. Use this OR base64Data.',
        },
        base64Data: {
          type: 'string',
          description: 'Base64-encoded file content. MUST be used with filename and contentType.',
        },
        filename: {
          type: 'string',
          description: 'Filename for the attachment (e.g., "report.pdf"). REQUIRED when using base64Data.',
        },
        contentType: {
          type: 'string',
          description: 'MIME type of the file. REQUIRED for reliable uploads. See tool description for common types.',
        },
      },
      required: ['airtableApiKey', 'baseId', 'recordId', 'fieldIdOrName'],
      additionalProperties: false,
    },
  },
];
