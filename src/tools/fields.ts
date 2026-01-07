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
}
