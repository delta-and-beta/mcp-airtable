/**
 * Airtable field management tools
 */

import { z } from "zod";
import { extractApiKey } from "../lib/auth.js";
import { AirtableClient } from "../lib/airtable.js";
import { formatErrorResponse } from "../lib/errors.js";
import { FIELD_TYPES } from "../lib/field-types.js";
import type { FastMCP } from "fastmcp";

const CREATE_FIELD_DESCRIPTION = `Add a new field (column) to an existing table.

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
  "baseId": "appABC123def456gh",
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
}

EXAMPLE - Create a currency field:
{
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Invoices",
  "name": "Amount",
  "type": "currency",
  "options": { "symbol": "$", "precision": 2 }
}`;

const UPDATE_FIELD_DESCRIPTION = `Update a field's name or description. Cannot change field type.

LIMITATIONS:
- Cannot change field type (must delete and recreate)
- Cannot modify primary field name in some cases
- At least one of name or description must be provided

EXAMPLE:
{
  "baseId": "appABC123def456gh",
  "tableIdOrName": "Tasks",
  "fieldIdOrName": "Status",
  "name": "Task Status",
  "description": "Current status of the task"
}`;

const UPLOAD_ATTACHMENT_DESCRIPTION = `Upload a file directly to an Airtable attachment field.

REQUIREMENTS:
- The target record MUST already exist (create with create_record first)
- The target field MUST be an attachment type field
- You MUST provide contentType for reliable uploads
- Maximum file size: 5 MB (use URL method for larger files)

WORKFLOW:
1. Create the record first (if it doesn't exist): create_record
2. Get the recordId from step 1 (starts with "rec")
3. Call this tool with recordId, field name, file content, AND contentType
4. File is uploaded directly to Airtable's CDN

REQUIRED PARAMETERS:
- baseId: Base ID (starts with "app")
- recordId: Existing record ID (starts with "rec")
- fieldIdOrName: Attachment field name or ID
- contentType: MIME type of the file
- ONE OF: filePath OR (base64Data + filename)

NOTE: This endpoint does NOT require tableIdOrName - only baseId, recordId, and fieldIdOrName.

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

EXAMPLE - Upload a text file:
{
  "baseId": "appABC123def456gh",
  "recordId": "recXYZ789abc012de",
  "fieldIdOrName": "Attachments",
  "base64Data": "SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0IGZpbGUu",
  "filename": "hello.txt",
  "contentType": "text/plain"
}

EXAMPLE - Upload a PNG image:
{
  "baseId": "appABC123def456gh",
  "recordId": "recXYZ789abc012de",
  "fieldIdOrName": "Images",
  "base64Data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "filename": "pixel.png",
  "contentType": "image/png"
}`;

export function registerFieldsTools(server: FastMCP) {
  // create_field tool
  server.addTool({
    name: "create_field",
    description: CREATE_FIELD_DESCRIPTION,
    parameters: z.object({
      baseId: z
        .string()
        .regex(/^app[a-zA-Z0-9]{14}$/)
        .describe("Base ID (starts with 'app')"),
      tableIdOrName: z
        .string()
        .min(1)
        .describe("Table ID (starts with 'tbl') or exact table name"),
      name: z
        .string()
        .min(1)
        .max(255)
        .describe("Field name (must be unique within the table)"),
      type: z
        .enum(FIELD_TYPES)
        .describe("Field type (see description for options)"),
      description: z
        .string()
        .max(20000)
        .optional()
        .describe("Optional field description"),
      options: z
        .record(z.unknown())
        .optional()
        .describe("Type-specific options (required for some field types)"),
      airtableApiKey: z
        .string()
        .optional()
        .describe("Airtable API key (optional if passed via header)"),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);

        const field = await client.createField(
          args.tableIdOrName,
          {
            name: args.name,
            type: args.type,
            description: args.description,
            options: args.options,
          },
          args.baseId
        );

        return JSON.stringify(field, null, 2);
      } catch (error) {
        return JSON.stringify(
          formatErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          ),
          null,
          2
        );
      }
    },
  });

  // update_field tool
  server.addTool({
    name: "update_field",
    description: UPDATE_FIELD_DESCRIPTION,
    parameters: z.object({
      baseId: z
        .string()
        .regex(/^app[a-zA-Z0-9]{14}$/)
        .describe("Base ID (starts with 'app')"),
      tableIdOrName: z
        .string()
        .min(1)
        .describe("Table ID (starts with 'tbl') or exact table name"),
      fieldIdOrName: z
        .string()
        .min(1)
        .describe("Field ID (starts with 'fld') or exact field name"),
      name: z
        .string()
        .min(1)
        .max(255)
        .optional()
        .describe("New field name"),
      description: z
        .string()
        .max(20000)
        .optional()
        .describe("New field description"),
      airtableApiKey: z
        .string()
        .optional()
        .describe("Airtable API key (optional if passed via header)"),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);

        const field = await client.updateField(
          args.tableIdOrName,
          args.fieldIdOrName,
          {
            name: args.name,
            description: args.description,
          },
          args.baseId
        );

        return JSON.stringify(field, null, 2);
      } catch (error) {
        return JSON.stringify(
          formatErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          ),
          null,
          2
        );
      }
    },
  });

  // upload_attachment tool
  server.addTool({
    name: "upload_attachment",
    description: UPLOAD_ATTACHMENT_DESCRIPTION,
    parameters: z.object({
      baseId: z
        .string()
        .regex(/^app[a-zA-Z0-9]{14}$/)
        .describe("Base ID (starts with 'app')"),
      recordId: z
        .string()
        .regex(/^rec[a-zA-Z0-9]{14}$/)
        .describe("Record ID (starts with 'rec') - record must already exist"),
      fieldIdOrName: z
        .string()
        .min(1)
        .describe("Attachment field name or ID (starts with 'fld')"),
      filePath: z
        .string()
        .optional()
        .describe("Local file path to upload (use this OR base64Data)"),
      base64Data: z
        .string()
        .optional()
        .describe("Base64-encoded file content (use this OR filePath)"),
      filename: z
        .string()
        .optional()
        .describe("Filename for the attachment (required if using base64Data)"),
      contentType: z
        .string()
        .optional()
        .describe("MIME type of the file (required for reliable uploads)"),
      airtableApiKey: z
        .string()
        .optional()
        .describe("Airtable API key (optional if passed via header)"),
    }),
    execute: async (args, context) => {
      try {
        const apiKey = extractApiKey(args, context);
        const client = new AirtableClient(apiKey, args.baseId);

        const result = await client.uploadAttachment(
          args.recordId,
          args.fieldIdOrName,
          {
            baseId: args.baseId,
            filePath: args.filePath,
            base64Data: args.base64Data,
            filename: args.filename,
            contentType: args.contentType,
          }
        );

        // Extract attachment info from the response fields
        const fieldKey = Object.keys(result.fields)[0];
        const attachments = result.fields[fieldKey] as Array<{
          id: string;
          url: string;
          filename: string;
          size: number;
          type: string;
          width?: number;
          height?: number;
        }>;
        const attachment = attachments?.[attachments.length - 1]; // Get the newly added attachment

        return JSON.stringify(
          {
            success: true,
            recordId: result.id,
            createdTime: result.createdTime,
            attachment: attachment || result.fields,
          },
          null,
          2
        );
      } catch (error) {
        return JSON.stringify(
          formatErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          ),
          null,
          2
        );
      }
    },
  });
}
