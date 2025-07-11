import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool definitions for the MCP Airtable server.
 * These definitions describe the available tools and their input schemas.
 */
export const toolDefinitions: Tool[] = [
  {
    name: 'list_bases',
    description: 'List all available Airtable bases',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
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
        includeFields: {
          type: 'boolean',
          description: 'Include field definitions in the response (default: false)',
          default: false,
        },
      },
      additionalProperties: false,
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
                additionalProperties: true,
              },
            },
            required: ['name', 'type'],
            additionalProperties: false,
          },
          minItems: 1,
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['name', 'fields'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_table',
    description: 'Update table properties (name or description)',
    inputSchema: {
      type: 'object',
      properties: {
        tableIdOrName: {
          type: 'string',
          description: 'The ID or name of the table to update',
        },
        name: {
          type: 'string',
          description: 'New name for the table (optional)',
        },
        description: {
          type: 'string',
          description: 'New description for the table (optional)',
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['tableIdOrName'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_field',
    description: 'Create a new field in a table',
    inputSchema: {
      type: 'object',
      properties: {
        tableIdOrName: {
          type: 'string',
          description: 'The ID or name of the table',
        },
        name: {
          type: 'string',
          description: 'Name of the field to create',
        },
        type: {
          type: 'string',
          description: 'Field type',
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
          additionalProperties: true,
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['tableIdOrName', 'name', 'type'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_field',
    description: 'Update field properties (name or description)',
    inputSchema: {
      type: 'object',
      properties: {
        tableIdOrName: {
          type: 'string',
          description: 'The ID or name of the table',
        },
        fieldIdOrName: {
          type: 'string',
          description: 'The ID or name of the field to update',
        },
        name: {
          type: 'string',
          description: 'New name for the field (optional)',
        },
        description: {
          type: 'string',
          description: 'New description for the field (optional)',
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['tableIdOrName', 'fieldIdOrName'],
      additionalProperties: false,
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
      additionalProperties: false,
    },
  },
  {
    name: 'get_records',
    description: 'Get records from a table with optional filtering and sorting',
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
          description: 'Maximum number of records to return (default: 100)',
          minimum: 1,
          maximum: 1000,
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
              field: { 
                type: 'string',
                description: 'Field name to sort by',
              },
              direction: { 
                type: 'string', 
                enum: ['asc', 'desc'],
                description: 'Sort direction',
              },
            },
            required: ['field'],
            additionalProperties: false,
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
      additionalProperties: false,
    },
  },
  {
    name: 'get_record',
    description: 'Get a single record by ID',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        recordId: {
          type: 'string',
          description: 'The ID of the record',
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['tableName', 'recordId'],
      additionalProperties: false,
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
          additionalProperties: true,
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
        typecast: {
          type: 'boolean',
          description: 'Automatically typecast values to match field types',
          default: false,
        },
      },
      required: ['tableName', 'fields'],
      additionalProperties: false,
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
          additionalProperties: true,
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
        typecast: {
          type: 'boolean',
          description: 'Automatically typecast values to match field types',
          default: false,
        },
      },
      required: ['tableName', 'recordId', 'fields'],
      additionalProperties: false,
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
      additionalProperties: false,
    },
  },
  {
    name: 'get_schema',
    description: 'Get the schema of a base including all tables and fields',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'upload_attachment',
    description: 'Upload a file to cloud storage and get a URL for Airtable attachment fields. Provide either filePath OR (base64Data + filename)',
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
        storageProvider: {
          type: 'string',
          enum: ['s3', 'gcs'],
          description: 'Storage provider to use (defaults to configured provider)',
        },
      },
      required: [],
      additionalProperties: false,
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
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Record ID (for updates)',
              },
              fields: {
                type: 'object',
                description: 'The fields for the record',
                additionalProperties: true,
              },
            },
            required: ['fields'],
            additionalProperties: false,
          },
          description: 'Array of records to create or update',
          minItems: 1,
          maxItems: 10,
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
        typecast: {
          type: 'boolean',
          description: 'Automatically typecast values to match field types',
          default: false,
        },
      },
      required: ['tableName', 'records'],
      additionalProperties: false,
    },
  },
  {
    name: 'batch_delete',
    description: 'Delete multiple records in a single operation',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'The name of the table',
        },
        recordIds: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Array of record IDs to delete',
          minItems: 1,
          maxItems: 10,
        },
        baseId: {
          type: 'string',
          description: 'The ID of the base (optional if default base is set)',
        },
      },
      required: ['tableName', 'recordIds'],
      additionalProperties: false,
    },
  },
];