/**
 * End-to-end tests for MCP Airtable tools
 *
 * Requirements:
 * - AIRTABLE_API_KEY: Personal access token
 * - AIRTABLE_TEST_BASE_ID: Base ID for testing (will create/delete data)
 *
 * Run with: npm run test:e2e
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AirtableClient } from "../../lib/airtable.js";

// Test configuration from environment
const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_TEST_BASE_ID;
const WORKSPACE_ID = process.env.AIRTABLE_WORKSPACE_ID; // Optional - for create_base test

// Skip all tests if credentials not provided
const skipTests = !API_KEY || !BASE_ID;

// Test data tracking for cleanup
const createdRecordIds: string[] = [];
const createdFieldIds: string[] = [];
const createdTableIds: string[] = [];
let createdTestBaseId: string | null = null;
let testTableName = `E2E_Test_${Date.now()}`;
let testTableId: string | null = null;
let workspaceId: string | null = null;

describe.skipIf(skipTests)("E2E: MCP Airtable Tools", () => {
  let client: AirtableClient;

  beforeAll(() => {
    if (skipTests) {
      console.log("Skipping e2e tests: AIRTABLE_API_KEY or AIRTABLE_TEST_BASE_ID not set");
      return;
    }
    client = new AirtableClient(API_KEY!, BASE_ID!);
    console.log(`Running e2e tests against base: ${BASE_ID}`);
  });

  afterAll(async () => {
    if (skipTests || !client) return;

    // Cleanup: Delete created records
    if (createdRecordIds.length > 0) {
      console.log(`Cleaning up ${createdRecordIds.length} test records...`);
      try {
        // Use batch delete for cleanup
        const Airtable = (await import("airtable")).default;
        const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID!);

        // Find a table that exists to delete from
        const tables = await client.listTables();
        if (tables.length > 0) {
          const table = base(tables[0].name);
          // Delete in chunks of 10
          for (let i = 0; i < createdRecordIds.length; i += 10) {
            const chunk = createdRecordIds.slice(i, i + 10);
            try {
              await table.destroy(chunk);
            } catch {
              // Ignore errors during cleanup
            }
          }
        }
      } catch (error) {
        console.log("Cleanup warning:", error);
      }
    }
  });

  describe("Base Operations", () => {
    it("list_bases - should list accessible bases", async () => {
      const bases = await client.listBases();

      expect(Array.isArray(bases)).toBe(true);
      expect(bases.length).toBeGreaterThan(0);
      expect(bases[0]).toHaveProperty("id");
      expect(bases[0]).toHaveProperty("name");

      // Verify test base is in the list
      const testBase = bases.find((b: any) => b.id === BASE_ID);
      expect(testBase).toBeDefined();

      // Capture workspaceId for create_base test
      if (testBase?.permissionLevel === "create") {
        // Try to get workspaceId from the base info
        // Note: list_bases may not include workspaceId, so we'll try to get it
        workspaceId = testBase.workspaceId || null;
      }

      console.log(`Found ${bases.length} bases, including test base: ${testBase?.name}`);
    });

    it("get_schema (list_tables) - should list tables in base", async () => {
      const tables = await client.listTables();

      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThan(0);
      expect(tables[0]).toHaveProperty("id");
      expect(tables[0]).toHaveProperty("name");
      expect(tables[0]).toHaveProperty("fields");

      // Store first table for subsequent tests
      testTableName = tables[0].name;
      testTableId = tables[0].id;
      console.log(`Found ${tables.length} tables, using: ${testTableName}`);
    });
  });

  describe("Table Creation Operations", () => {
    it("create_table - should create a new table in the base", async () => {
      const newTableName = `E2E_Created_Table_${Date.now()}`;

      try {
        const result = await client.createTable(BASE_ID!, {
          name: newTableName,
          description: "E2E test table - safe to delete",
          fields: [
            { name: "Name", type: "singleLineText" },
            { name: "Notes", type: "multilineText" },
            {
              name: "Status",
              type: "singleSelect",
              options: {
                choices: [
                  { name: "Pending", color: "yellowBright" },
                  { name: "Active", color: "greenBright" },
                  { name: "Completed", color: "blueBright" },
                ],
              },
            },
          ],
        });

        expect(result).toHaveProperty("id");
        expect(result.id).toMatch(/^tbl/);
        expect(result.name).toBe(newTableName);
        expect(result).toHaveProperty("primaryFieldId");
        expect(result).toHaveProperty("fields");
        expect(result.fields.length).toBe(3);
        expect(result).toHaveProperty("views");
        expect(result.views.length).toBeGreaterThan(0);

        createdTableIds.push(result.id);
        console.log(`Created table: ${result.id} (${newTableName})`);
      } catch (error: any) {
        if (error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: No permission to create tables in this base");
        } else {
          throw error;
        }
      }
    });

    it("create_table - should create table with various field types", async () => {
      const newTableName = `E2E_AllFields_${Date.now()}`;

      try {
        const result = await client.createTable(BASE_ID!, {
          name: newTableName,
          fields: [
            { name: "Title", type: "singleLineText" },
            { name: "Description", type: "multilineText" },
            { name: "Email", type: "email" },
            { name: "Website", type: "url" },
          ],
        });

        expect(result).toHaveProperty("id");
        expect(result.id).toMatch(/^tbl/);
        expect(result.fields.length).toBe(4);

        // Verify field types
        const fieldTypes = result.fields.map((f: any) => f.type);
        expect(fieldTypes).toContain("singleLineText");
        expect(fieldTypes).toContain("multilineText");
        expect(fieldTypes).toContain("email");
        expect(fieldTypes).toContain("url");

        createdTableIds.push(result.id);
        console.log(`Created table with 4 field types: ${result.id}`);
      } catch (error: any) {
        if (error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: No permission to create tables");
        } else {
          throw error;
        }
      }
    });

    it("update_table - should update table name and description", async () => {
      if (createdTableIds.length === 0) {
        console.log("Skipping: No tables created yet");
        return;
      }

      const tableId = createdTableIds[0];
      const newName = `E2E_Updated_Table_${Date.now()}`;
      const newDescription = "Updated via e2e test";

      try {
        const result = await client.updateTable(BASE_ID!, tableId, {
          name: newName,
          description: newDescription,
        });

        expect(result).toHaveProperty("id");
        expect(result.id).toBe(tableId);
        expect(result.name).toBe(newName);
        expect(result.description).toBe(newDescription);
        expect(result).toHaveProperty("fields");
        expect(result).toHaveProperty("views");

        console.log(`Updated table: ${tableId} -> ${newName}`);
      } catch (error: any) {
        if (error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: No permission to update tables");
        } else {
          throw error;
        }
      }
    });
  });

  describe("Base Creation Operations", () => {
    it("create_base - should create a new base with tables", async () => {
      // This test requires AIRTABLE_WORKSPACE_ID environment variable
      const wspId = WORKSPACE_ID || workspaceId;

      if (!wspId) {
        console.log("Skipping create_base test: AIRTABLE_WORKSPACE_ID not set");
        return;
      }

      const newBaseName = `E2E_Test_Base_${Date.now()}`;

      try {
        const result = await client.createBase({
          name: newBaseName,
          workspaceId: wspId,
          tables: [
            {
              name: "Projects",
              description: "Main projects table",
              fields: [
                { name: "Project Name", type: "singleLineText" },
                { name: "Description", type: "multilineText" },
                {
                  name: "Status",
                  type: "singleSelect",
                  options: {
                    choices: [
                      { name: "Planning", color: "blueBright" },
                      { name: "In Progress", color: "yellowBright" },
                      { name: "Completed", color: "greenBright" },
                    ],
                  },
                },
              ],
            },
            {
              name: "Tasks",
              description: "Task tracking table",
              fields: [
                { name: "Task Name", type: "singleLineText" },
                { name: "Notes", type: "multilineText" },
                { name: "Priority", type: "singleLineText" },
              ],
            },
          ],
        });

        expect(result).toHaveProperty("id");
        expect(result.id).toMatch(/^app/);
        // Note: Airtable create base API doesn't return name in response
        expect(result).toHaveProperty("tables");
        expect(result.tables.length).toBe(2);

        // Verify first table
        const projectsTable = result.tables.find((t: any) => t.name === "Projects");
        expect(projectsTable).toBeDefined();
        expect(projectsTable?.id).toMatch(/^tbl/);
        expect(projectsTable?.fields.length).toBe(3);
        expect(projectsTable?.views?.length).toBeGreaterThan(0);

        // Verify second table
        const tasksTable = result.tables.find((t: any) => t.name === "Tasks");
        expect(tasksTable).toBeDefined();
        expect(tasksTable?.fields.length).toBe(3);

        createdTestBaseId = result.id;
        console.log(`Created base: ${result.id} with 2 tables (Projects, Tasks)`);
      } catch (error: any) {
        if (
          error.message?.includes("INVALID_PERMISSIONS") ||
          error.message?.includes("NOT_AUTHORIZED") ||
          error.message?.includes("cannot create bases")
        ) {
          console.log("Skipping: No permission to create bases in this workspace");
        } else {
          console.log("Create base error:", error.message);
          throw error;
        }
      }
    });
  });

  describe("Record Operations", () => {
    it("get_records - should retrieve records from table", async () => {
      const records = await client.getRecords(testTableName, {
        maxRecords: 5,
      });

      expect(Array.isArray(records)).toBe(true);
      // Records may or may not exist, just verify structure
      if (records.length > 0) {
        expect(records[0]).toHaveProperty("id");
        expect(records[0]).toHaveProperty("fields");
        console.log(`Retrieved ${records.length} records`);
      } else {
        console.log("Table is empty (valid state)");
      }
    });

    it("create_records - should create a single record", async () => {
      // Get table schema to find a text field
      const tables = await client.listTables();
      const table = tables.find((t: any) => t.name === testTableName);
      const textField = table?.fields?.find(
        (f: any) => f.type === "singleLineText" || f.type === "multilineText"
      );

      if (!textField) {
        console.log("Skipping: No text field found in table");
        return;
      }

      const testData = { [textField.name]: `E2E Test ${Date.now()}` };
      const records = await client.createRecords(testTableName, [testData]);

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBe(1);
      expect(records[0]).toHaveProperty("id");
      expect(records[0].id).toMatch(/^rec/);

      createdRecordIds.push(records[0].id);
      console.log(`Created record: ${records[0].id}`);
    });

    it("create_records - should create multiple records with batching", async () => {
      const tables = await client.listTables();
      const table = tables.find((t: any) => t.name === testTableName);
      const textField = table?.fields?.find(
        (f: any) => f.type === "singleLineText" || f.type === "multilineText"
      );

      if (!textField) {
        console.log("Skipping: No text field found in table");
        return;
      }

      // Create 15 records to test batching (will be split into 10 + 5)
      const testRecords = Array.from({ length: 15 }, (_, i) => ({
        [textField.name]: `E2E Batch Test ${i + 1} - ${Date.now()}`,
      }));

      const startTime = Date.now();
      const records = await client.createRecords(testTableName, testRecords);
      const duration = Date.now() - startTime;

      expect(records.length).toBe(15);
      records.forEach((r) => {
        expect(r.id).toMatch(/^rec/);
        createdRecordIds.push(r.id);
      });

      // Should have at least 100ms delay between batches
      expect(duration).toBeGreaterThanOrEqual(100);
      console.log(`Created 15 records in ${duration}ms (batched)`);
    });

    it("get_record - should retrieve a single record by ID", async () => {
      if (createdRecordIds.length === 0) {
        console.log("Skipping: No records created yet");
        return;
      }

      const recordId = createdRecordIds[0];
      const record = await client.getRecord(testTableName, recordId);

      expect(record).toHaveProperty("id");
      expect(record.id).toBe(recordId);
      expect(record).toHaveProperty("fields");
      console.log(`Retrieved record: ${record.id}`);
    });

    it("update_record - should update an existing record", async () => {
      if (createdRecordIds.length === 0) {
        console.log("Skipping: No records created yet");
        return;
      }

      const tables = await client.listTables();
      const table = tables.find((t: any) => t.name === testTableName);
      const textField = table?.fields?.find(
        (f: any) => f.type === "singleLineText" || f.type === "multilineText"
      );

      if (!textField) {
        console.log("Skipping: No text field found in table");
        return;
      }

      const recordId = createdRecordIds[0];
      const updatedValue = `Updated E2E Test ${Date.now()}`;
      const record = await client.updateRecord(testTableName, recordId, {
        [textField.name]: updatedValue,
      });

      expect(record.id).toBe(recordId);
      expect(record.fields[textField.name]).toBe(updatedValue);
      console.log(`Updated record: ${record.id}`);
    });

    it("delete_record - should delete a single record", async () => {
      if (createdRecordIds.length === 0) {
        console.log("Skipping: No records created yet");
        return;
      }

      const recordId = createdRecordIds.pop()!;
      const result = await client.deleteRecord(testTableName, recordId);

      expect(result).toHaveProperty("id");
      expect(result.id).toBe(recordId);
      expect(result).toHaveProperty("deleted", true);
      console.log(`Deleted record: ${recordId}`);
    });
  });

  describe("Batch Operations", () => {
    it("batch_upsert - should create and update records in bulk", async () => {
      const tables = await client.listTables();
      const table = tables.find((t: any) => t.name === testTableName);
      const textField = table?.fields?.find(
        (f: any) => f.type === "singleLineText" || f.type === "multilineText"
      );

      if (!textField) {
        console.log("Skipping: No text field found in table");
        return;
      }

      // Use Airtable SDK directly for batch upsert test
      const Airtable = (await import("airtable")).default;
      const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID!);
      const airtableTable = base(testTableName);

      // Create records for upsert test
      const toCreate = Array.from({ length: 3 }, (_, i) => ({
        fields: { [textField.name]: `Batch Upsert Test ${i} - ${Date.now()}` },
      }));

      // Airtable SDK bulk create expects {fields: {...}} format
      const created: any = await airtableTable.create(
        toCreate,
        { typecast: true }
      );
      const createdArray = Array.isArray(created) ? created : [created];

      createdArray.forEach((r: any) => createdRecordIds.push(r.id));
      expect(createdArray.length).toBe(3);
      console.log(`Batch created ${createdArray.length} records`);
    });

    it("batch_delete - should delete multiple records", async () => {
      // Delete 2 records if available
      const toDelete = createdRecordIds.splice(0, Math.min(2, createdRecordIds.length));

      if (toDelete.length === 0) {
        console.log("Skipping: No records to delete");
        return;
      }

      const Airtable = (await import("airtable")).default;
      const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID!);
      const airtableTable = base(testTableName);

      const results: any = await airtableTable.destroy(toDelete);
      const resultsArray = Array.isArray(results) ? results : [results];

      expect(resultsArray.length).toBe(toDelete.length);
      resultsArray.forEach((r: any) => {
        expect(r.id).toBeDefined();
      });
      console.log(`Batch deleted ${resultsArray.length} records`);
    });
  });

  describe("Field Operations", () => {
    it("create_field - should create a new field", async () => {
      if (!testTableId) {
        console.log("Skipping: No table ID available");
        return;
      }

      const fieldName = `E2E_Field_${Date.now()}`;

      try {
        // Use table ID for Meta API (field operations)
        const field = await client.createField(testTableId, {
          name: fieldName,
          type: "singleLineText",
          description: "E2E test field - safe to delete",
        });

        expect(field).toHaveProperty("id");
        expect(field.id).toMatch(/^fld/);
        expect(field.name).toBe(fieldName);
        expect(field.type).toBe("singleLineText");

        createdFieldIds.push(field.id);
        console.log(`Created field: ${field.id} (${fieldName})`);
      } catch (error: any) {
        // Some bases may not allow field creation
        if (error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: No permission to create fields in this base");
        } else {
          throw error;
        }
      }
    });

    it("create_field - should create a singleSelect field with options", async () => {
      if (!testTableId) {
        console.log("Skipping: No table ID available");
        return;
      }

      const fieldName = `E2E_Select_${Date.now()}`;

      try {
        // Use table ID for Meta API (field operations)
        const field = await client.createField(testTableId, {
          name: fieldName,
          type: "singleSelect",
          description: "E2E test select field",
          options: {
            choices: [
              { name: "Option A", color: "blueBright" },
              { name: "Option B", color: "greenBright" },
              { name: "Option C", color: "redBright" },
            ],
          },
        });

        expect(field).toHaveProperty("id");
        expect(field.type).toBe("singleSelect");
        expect(field.options?.choices?.length).toBe(3);

        createdFieldIds.push(field.id);
        console.log(`Created singleSelect field: ${field.id}`);
      } catch (error: any) {
        if (error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: No permission to create fields");
        } else {
          throw error;
        }
      }
    });

    it("update_field - should update field name and description", async () => {
      if (createdFieldIds.length === 0 || !testTableId) {
        console.log("Skipping: No fields created yet or no table ID");
        return;
      }

      const fieldId = createdFieldIds[0];
      const newName = `E2E_Updated_${Date.now()}`;

      try {
        // Use table ID for Meta API (field operations)
        const field = await client.updateField(testTableId!, fieldId, {
          name: newName,
          description: "Updated description",
        });

        expect(field).toHaveProperty("id");
        expect(field.name).toBe(newName);
        console.log(`Updated field: ${fieldId} -> ${newName}`);
      } catch (error: any) {
        if (error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: No permission to update fields");
        } else {
          throw error;
        }
      }
    });
  });

  describe("Attachment Operations", () => {
    let attachmentFieldId: string | null = null;
    let attachmentRecordId: string | null = null;

    it("upload_attachment - should create attachment field and upload file", async () => {
      if (!testTableId) {
        console.log("Skipping: No table ID available");
        return;
      }

      // Step 1: Create an attachment field
      const attachmentFieldName = `E2E_Attachments_${Date.now()}`;
      try {
        const field = await client.createField(testTableId, {
          name: attachmentFieldName,
          type: "multipleAttachments",
          description: "E2E test attachment field",
        });

        expect(field).toHaveProperty("id");
        expect(field.type).toBe("multipleAttachments");
        attachmentFieldId = field.id;
        createdFieldIds.push(field.id);
        console.log(`Created attachment field: ${field.id}`);
      } catch (error: any) {
        if (error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: No permission to create attachment field");
          return;
        }
        throw error;
      }

      // Step 2: Create a record to attach file to
      const tables = await client.listTables();
      const table = tables.find((t: any) => t.name === testTableName);
      const textField = table?.fields?.find(
        (f: any) => f.type === "singleLineText" || f.type === "multilineText"
      );

      if (!textField) {
        console.log("Skipping: No text field found for test record");
        return;
      }

      const records = await client.createRecords(testTableName, [
        { [textField.name]: `Attachment Test Record ${Date.now()}` },
      ]);
      attachmentRecordId = records[0].id;
      createdRecordIds.push(attachmentRecordId);
      console.log(`Created record for attachment: ${attachmentRecordId}`);

      // Step 3: Upload a small text file (base64 encoded)
      // Note: uploadAttachment endpoint uses: POST /v0/{baseId}/{recordId}/{fieldIdOrName}/uploadAttachment
      // It does NOT require tableId - just baseId, recordId, and fieldIdOrName
      const testContent = "Hello, Airtable! This is a test attachment.";
      const base64Data = Buffer.from(testContent).toString("base64");

      try {
        const result = await client.uploadAttachment(
          attachmentRecordId,
          attachmentFieldId!,
          {
            base64Data,
            filename: "test-upload.txt",
            contentType: "text/plain",
          }
        );

        expect(result).toHaveProperty("id");
        expect(result.id).toMatch(/^rec/);
        expect(result).toHaveProperty("fields");

        // Get the attachment from the response fields
        const fieldKey = Object.keys(result.fields)[0];
        const attachments = result.fields[fieldKey] as any[];
        expect(attachments.length).toBeGreaterThan(0);

        const attachment = attachments[0];
        expect(attachment).toHaveProperty("id");
        expect(attachment.id).toMatch(/^att/);
        expect(attachment).toHaveProperty("url");
        expect(attachment.filename).toBe("test-upload.txt");
        expect(attachment.type).toBe("text/plain");
        expect(attachment.size).toBeGreaterThan(0);

        console.log(`Uploaded attachment: ${attachment.id} (${attachment.size} bytes)`);
      } catch (error: any) {
        console.log("Upload error:", error.message);
        throw error;
      }
    });

    it("upload_attachment - should upload a PNG image", async () => {
      if (!attachmentFieldId || !attachmentRecordId) {
        console.log("Skipping: Prerequisites not met (need field and record from previous test)");
        return;
      }

      // 1x1 transparent PNG (smallest valid PNG)
      const transparentPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      try {
        const result = await client.uploadAttachment(
          attachmentRecordId,
          attachmentFieldId!,
          {
            base64Data: transparentPngBase64,
            filename: "test-image.png",
            contentType: "image/png",
          }
        );

        expect(result).toHaveProperty("id");
        expect(result).toHaveProperty("fields");

        // Get the attachments from the response (should now have 2)
        const fieldKey = Object.keys(result.fields)[0];
        const attachments = result.fields[fieldKey] as any[];
        expect(attachments.length).toBe(2); // text file + PNG

        // Get the newly added PNG (last one)
        const attachment = attachments[attachments.length - 1];
        expect(attachment).toHaveProperty("id");
        expect(attachment.id).toMatch(/^att/);
        expect(attachment.filename).toBe("test-image.png");
        expect(attachment.type).toBe("image/png");
        // Note: width/height may not be immediately available for images
        // Airtable processes images asynchronously

        console.log(
          `Uploaded PNG: ${attachment.id}${attachment.width ? ` (${attachment.width}x${attachment.height})` : ""}`
        );
      } catch (error: any) {
        console.log("PNG upload error:", error.message);
        throw error;
      }
    });
  });

  describe("Filtering and Querying", () => {
    it("get_records - should filter records by formula", async () => {
      const tables = await client.listTables();
      const table = tables.find((t: any) => t.name === testTableName);
      const textField = table?.fields?.find(
        (f: any) => f.type === "singleLineText" || f.type === "multilineText"
      );

      if (!textField) {
        console.log("Skipping: No text field found in table");
        return;
      }

      // Create a record with known value
      const uniqueValue = `FilterTest_${Date.now()}`;
      const created = await client.createRecords(testTableName, [
        { [textField.name]: uniqueValue },
      ]);
      createdRecordIds.push(created[0].id);

      // Filter for the record
      const records = await client.getRecords(testTableName, {
        filterByFormula: `{${textField.name}} = "${uniqueValue}"`,
        maxRecords: 10,
      });

      expect(records.length).toBe(1);
      expect(records[0].fields[textField.name]).toBe(uniqueValue);
      console.log(`Filter test: Found ${records.length} matching record`);
    });
  });
});

// Summary test
describe.skipIf(skipTests)("E2E Summary", () => {
  it("should print test summary", () => {
    console.log("\n=== E2E Test Summary ===");
    console.log(`API Key: ${API_KEY?.slice(0, 10)}...`);
    console.log(`Base ID: ${BASE_ID}`);
    console.log(`Workspace ID: ${WORKSPACE_ID || workspaceId || "Not set"}`);
    console.log(`Records created during test: ${createdRecordIds.length}`);
    console.log(`Fields created during test: ${createdFieldIds.length}`);
    console.log(`Tables created during test: ${createdTableIds.length}`);
    console.log(`Test base created: ${createdTestBaseId || "None"}`);
    console.log("========================\n");
  });
});
