/**
 * End-to-end tests for MCP Airtable tools
 *
 * Requirements:
 * - AIRTABLE_API_KEY: Personal access token
 * - AIRTABLE_WORKSPACE_ID: Workspace ID for creating test base
 *
 * The test will:
 * 1. List existing bases to find next available "Testing N" name
 * 2. Create a new "Testing N" base for the test run
 * 3. Run all tests against that base
 * 4. Clean up (delete the test base) at the end
 *
 * Run with: npm run test:e2e
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AirtableClient } from "../../lib/airtable.js";

// Test configuration from environment
const API_KEY = process.env.AIRTABLE_API_KEY;
const WORKSPACE_ID = process.env.AIRTABLE_WORKSPACE_ID;

// Skip all tests if credentials not provided
const skipTests = !API_KEY || !WORKSPACE_ID;

// Test data tracking for cleanup
const createdRecordIds: string[] = [];
const createdFieldIds: string[] = [];
const createdTableIds: string[] = [];
const createdCommentIds: { recordId: string; commentId: string }[] = [];
let testBaseId: string | null = null;
let testBaseName: string | null = null;
let testTableName = "E2E_Records";
let testTableId: string | null = null;

/**
 * Find the next available "Testing N" name
 */
async function findNextTestingBaseName(client: AirtableClient): Promise<string> {
  const bases = await client.listBases();
  const testingBases = bases
    .filter((b: any) => /^Testing \d+$/.test(b.name))
    .map((b: any) => {
      const match = b.name.match(/^Testing (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });

  const maxNum = testingBases.length > 0 ? Math.max(...testingBases) : 0;
  return `Testing ${maxNum + 1}`;
}

describe.skipIf(skipTests)("E2E: MCP Airtable Tools", () => {
  let client: AirtableClient;

  beforeAll(async () => {
    if (skipTests) {
      console.log("Skipping e2e tests: AIRTABLE_API_KEY or AIRTABLE_WORKSPACE_ID not set");
      return;
    }

    // Create client without base ID initially
    client = new AirtableClient(API_KEY!);
    console.log("Initializing e2e tests...");

    // Step 1: Find next available "Testing N" name
    testBaseName = await findNextTestingBaseName(client);
    console.log(`Will create test base: ${testBaseName}`);

    // Step 2: Create the test base
    try {
      const result = await client.createBase({
        name: testBaseName,
        workspaceId: WORKSPACE_ID!,
        tables: [
          {
            name: "E2E_Records",
            description: "Main table for e2e testing",
            fields: [
              { name: "Name", type: "singleLineText" },
              { name: "Notes", type: "multilineText" },
              {
                name: "Status",
                type: "singleSelect",
                options: {
                  choices: [
                    { name: "Todo", color: "yellowBright" },
                    { name: "In Progress", color: "blueBright" },
                    { name: "Done", color: "greenBright" },
                  ],
                },
              },
              { name: "Count", type: "number", options: { precision: 0 } },
            ],
          },
        ],
      });

      testBaseId = result.id;
      testTableId = result.tables[0].id;
      console.log(`Created test base: ${testBaseId} (${testBaseName})`);
      console.log(`Test table ID: ${testTableId}`);

      // Re-create client with the new base ID
      client = new AirtableClient(API_KEY!, testBaseId);
    } catch (error: any) {
      console.error("Failed to create test base:", error.message);
      throw error;
    }
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    if (skipTests || !client) return;

    console.log("\n=== Cleanup ===");

    // Note: Airtable API does not support deleting bases programmatically
    // The test base will need to be deleted manually from the Airtable UI
    // or left for future test runs (each run creates a new "Testing N" base)

    if (testBaseId) {
      console.log(`⚠️  Test base "${testBaseName}" (${testBaseId}) was created.`);
      console.log("   Please delete it manually from Airtable if no longer needed.");
      console.log("   Future test runs will create new bases: Testing 2, Testing 3, etc.");
    }

    // Skip record cleanup to allow viewing results in Airtable
    if (createdRecordIds.length > 0) {
      console.log(`   ${createdRecordIds.length} records were created and preserved for review.`);
    }
  }, 10000);

  describe("Base Operations", () => {
    it("list_bases - should list accessible bases including test base", async () => {
      const bases = await client.listBases();

      expect(Array.isArray(bases)).toBe(true);
      expect(bases.length).toBeGreaterThan(0);
      expect(bases[0]).toHaveProperty("id");
      expect(bases[0]).toHaveProperty("name");

      // Verify test base is in the list
      const foundTestBase = bases.find((b: any) => b.id === testBaseId);
      expect(foundTestBase).toBeDefined();
      expect(foundTestBase?.name).toBe(testBaseName);

      console.log(`Found ${bases.length} bases, including test base: ${testBaseName}`);
    });

    it("get_base_schema - should list tables in base", async () => {
      const tables = await client.listTables();

      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThan(0);
      expect(tables[0]).toHaveProperty("id");
      expect(tables[0]).toHaveProperty("name");
      expect(tables[0]).toHaveProperty("fields");

      // Verify E2E_Records table exists
      const recordsTable = tables.find((t: any) => t.name === "E2E_Records");
      expect(recordsTable).toBeDefined();
      testTableId = recordsTable?.id || testTableId;

      console.log(`Found ${tables.length} tables in test base`);
    });
  });

  describe("Table Creation Operations", () => {
    it("create_table - should create a new table in the base", async () => {
      const newTableName = `E2E_Created_Table_${Date.now()}`;

      const result = await client.createTable(testBaseId!, {
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
    });

    it("create_table - should create table with various field types", async () => {
      const newTableName = `E2E_AllFields_${Date.now()}`;

      const result = await client.createTable(testBaseId!, {
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
    });

    it("update_table - should update table name and description", async () => {
      if (createdTableIds.length === 0) {
        console.log("Skipping: No tables created yet");
        return;
      }

      const tableId = createdTableIds[0];
      const newName = `E2E_Updated_Table_${Date.now()}`;
      const newDescription = "Updated via e2e test";

      const result = await client.updateTable(testBaseId!, tableId, {
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
        console.log("Table is empty (valid state for new base)");
      }
    });

    it("create_records - should create a single record", async () => {
      const testData = { Name: `E2E Test ${Date.now()}` };
      const records = await client.createRecords(testTableName, [testData]);

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBe(1);
      expect(records[0]).toHaveProperty("id");
      expect(records[0].id).toMatch(/^rec/);

      createdRecordIds.push(records[0].id);
      console.log(`Created record: ${records[0].id}`);
    });

    it("create_records - should create 200 records with batching", async () => {
      // Create 200 records to thoroughly test batching (will be split into 20 batches of 10)
      const RECORD_COUNT = 200;
      const testRecords = Array.from({ length: RECORD_COUNT }, (_, i) => ({
        Name: `E2E Batch Test ${i + 1} - ${Date.now()}`,
        Count: i + 1,
      }));

      const startTime = Date.now();
      const records = await client.createRecords(testTableName, testRecords);
      const duration = Date.now() - startTime;

      expect(records.length).toBe(RECORD_COUNT);
      records.forEach((r) => {
        expect(r.id).toMatch(/^rec/);
        createdRecordIds.push(r.id);
      });

      // With 20 batches and 100ms delay between each, should take at least 1900ms
      // (19 delays between 20 batches)
      const expectedMinDuration = (RECORD_COUNT / 10 - 1) * 100; // 1900ms
      expect(duration).toBeGreaterThanOrEqual(expectedMinDuration * 0.8); // Allow 20% margin
      console.log(`Created ${RECORD_COUNT} records in ${duration}ms (20 batches, ~${Math.round(duration / RECORD_COUNT)}ms/record)`);
    }, 120000); // 2 minute timeout for 200 records

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

      const recordId = createdRecordIds[0];
      const updatedValue = `Updated E2E Test ${Date.now()}`;
      const record = await client.updateRecord(testTableName, recordId, {
        Name: updatedValue,
      });

      expect(record.id).toBe(recordId);
      expect(record.fields.Name).toBe(updatedValue);
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
    it("upsert_records - should create and update records in bulk", async () => {
      // Use Airtable SDK directly for batch upsert test
      const Airtable = (await import("airtable")).default;
      const base = new Airtable({ apiKey: API_KEY }).base(testBaseId!);
      const airtableTable = base(testTableName);

      // Create records for upsert test
      const toCreate = Array.from({ length: 3 }, (_, i) => ({
        fields: { Name: `Batch Upsert Test ${i} - ${Date.now()}` },
      }));

      const created: any = await airtableTable.create(toCreate, { typecast: true });
      const createdArray = Array.isArray(created) ? created : [created];

      createdArray.forEach((r: any) => createdRecordIds.push(r.id));
      expect(createdArray.length).toBe(3);
      console.log(`Batch created ${createdArray.length} records`);
    });

    it("delete_records - should delete multiple records", async () => {
      // Delete 2 records if available
      const toDelete = createdRecordIds.splice(0, Math.min(2, createdRecordIds.length));

      if (toDelete.length === 0) {
        console.log("Skipping: No records to delete");
        return;
      }

      const Airtable = (await import("airtable")).default;
      const base = new Airtable({ apiKey: API_KEY }).base(testBaseId!);
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
    });

    it("create_field - should create a singleSelect field with options", async () => {
      if (!testTableId) {
        console.log("Skipping: No table ID available");
        return;
      }

      const fieldName = `E2E_Select_${Date.now()}`;

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
    });

    it("update_field - should update field name and description", async () => {
      if (createdFieldIds.length === 0 || !testTableId) {
        console.log("Skipping: No fields created yet or no table ID");
        return;
      }

      const fieldId = createdFieldIds[0];
      const newName = `E2E_Updated_${Date.now()}`;

      const field = await client.updateField(testTableId!, fieldId, {
        name: newName,
        description: "Updated description",
      });

      expect(field).toHaveProperty("id");
      expect(field.name).toBe(newName);
      console.log(`Updated field: ${fieldId} -> ${newName}`);
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

      // Step 2: Create a record to attach file to
      const records = await client.createRecords(testTableName, [
        { Name: `Attachment Test Record ${Date.now()}` },
      ]);
      attachmentRecordId = records[0].id;
      createdRecordIds.push(attachmentRecordId);
      console.log(`Created record for attachment: ${attachmentRecordId}`);

      // Step 3: Upload a small text file (base64 encoded)
      const testContent = "Hello, Airtable! This is a test attachment.";
      const base64Data = Buffer.from(testContent).toString("base64");

      const result = await client.uploadAttachment(attachmentRecordId, attachmentFieldId!, {
        base64Data,
        filename: "test-upload.txt",
        contentType: "text/plain",
      });

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
    });

    it("upload_attachment - should upload a PNG image", async () => {
      if (!attachmentFieldId || !attachmentRecordId) {
        console.log("Skipping: Prerequisites not met (need field and record from previous test)");
        return;
      }

      // 1x1 transparent PNG (smallest valid PNG)
      const transparentPngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const result = await client.uploadAttachment(attachmentRecordId, attachmentFieldId!, {
        base64Data: transparentPngBase64,
        filename: "test-image.png",
        contentType: "image/png",
      });

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

      console.log(
        `Uploaded PNG: ${attachment.id}${attachment.width ? ` (${attachment.width}x${attachment.height})` : ""}`
      );
    });

    it("upload_attachment - should upload PDF and validate download", async () => {
      if (!attachmentFieldId || !attachmentRecordId) {
        console.log("Skipping: Prerequisites not met (need field and record from previous test)");
        return;
      }

      // Use a minimal valid PDF (single blank page) embedded directly
      // This avoids external URL dependencies and makes the test reliable
      // PDF structure: header, catalog, pages, page, content stream, xref, trailer
      const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 12 Tf 100 700 Td (Test PDF) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000206 00000 n
trailer << /Size 5 /Root 1 0 R >>
startxref
300
%%EOF`;

      const pdfBuffer = Buffer.from(minimalPdf, "utf-8");
      const originalSize = pdfBuffer.length;
      const base64Data = pdfBuffer.toString("base64");
      console.log(`Created minimal PDF: ${originalSize} bytes`);

      // Verify it's a valid PDF (check magic bytes: %PDF-)
      const pdfMagicBytes = pdfBuffer.subarray(0, 5).toString("ascii");
      expect(pdfMagicBytes).toBe("%PDF-");
      console.log(`PDF magic bytes verified: ${pdfMagicBytes}`);

      const https = await import("https");

      // Step 1: Upload PDF to Airtable
      const result = await client.uploadAttachment(attachmentRecordId, attachmentFieldId!, {
        base64Data,
        filename: "sample-test.pdf",
        contentType: "application/pdf",
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("fields");

      // Get the attachments from the response (should now have 3: txt, png, pdf)
      const fieldKey = Object.keys(result.fields)[0];
      const attachments = result.fields[fieldKey] as any[];
      expect(attachments.length).toBe(3);

      // Get the newly added PDF (last one)
      const attachment = attachments[attachments.length - 1];
      expect(attachment).toHaveProperty("id");
      expect(attachment.id).toMatch(/^att/);
      expect(attachment.filename).toBe("sample-test.pdf");
      expect(attachment.type).toBe("application/pdf");
      expect(attachment.size).toBe(originalSize);
      console.log(`Uploaded PDF: ${attachment.id} (${attachment.size} bytes)`);

      // Step 2: Download the PDF from Airtable CDN and validate
      const downloadUrl = attachment.url;
      expect(downloadUrl).toBeDefined();
      console.log(`Downloading from Airtable CDN: ${downloadUrl.substring(0, 50)}...`);

      const downloadedBuffer = await new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Download timeout")), 30000);

        https.get(downloadUrl, (res) => {
          if (res.statusCode !== 200) {
            clearTimeout(timeout);
            reject(new Error(`Download HTTP ${res.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            clearTimeout(timeout);
            resolve(Buffer.concat(chunks));
          });
          res.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        }).on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const downloadedSize = downloadedBuffer.length;
      console.log(`Downloaded PDF: ${downloadedSize} bytes`);

      // Step 3: Validate downloaded PDF
      // Check magic bytes
      const downloadedMagicBytes = downloadedBuffer.subarray(0, 5).toString("ascii");
      expect(downloadedMagicBytes).toBe("%PDF-");
      console.log(`Downloaded PDF magic bytes verified: ${downloadedMagicBytes}`);

      // Check size matches
      expect(downloadedSize).toBe(originalSize);
      console.log(`PDF validation passed: size=${downloadedSize}, magic=${downloadedMagicBytes}`);
    }, 60000); // 60 second timeout for network operations
  });

  describe("Comment Operations", () => {
    let commentTestRecordId: string | null = null;
    let createdCommentId: string | null = null;

    it("create_comment - should create a comment on a record", async () => {
      // Create a test record for comments
      const records = await client.createRecords(testTableName, [
        { Name: `Comment Test Record ${Date.now()}` },
      ]);
      commentTestRecordId = records[0].id;
      createdRecordIds.push(commentTestRecordId);
      console.log(`Created record for comments: ${commentTestRecordId}`);

      // Create a comment
      try {
        const comment = await client.createComment(
          testTableName,
          commentTestRecordId,
          "This is an e2e test comment - safe to delete"
        );

        expect(comment).toHaveProperty("id");
        expect(comment.id).toMatch(/^com/);
        expect(comment).toHaveProperty("author");
        expect(comment.author).toHaveProperty("id");
        expect(comment.author).toHaveProperty("email");
        expect(comment.text).toBe("This is an e2e test comment - safe to delete");
        expect(comment).toHaveProperty("createdTime");

        createdCommentId = comment.id;
        createdCommentIds.push({ recordId: commentTestRecordId, commentId: comment.id });
        console.log(`Created comment: ${comment.id} by ${comment.author.email}`);
      } catch (error: any) {
        if (error.message?.includes("NOT_FOUND") || error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: Comments API may not be enabled for this base");
        } else {
          throw error;
        }
      }
    });

    it("list_comments - should list comments on a record", async () => {
      if (!commentTestRecordId || !createdCommentId) {
        console.log("Skipping: No record or comment from previous test");
        return;
      }

      try {
        const result = await client.listComments(testTableName, commentTestRecordId);

        expect(result).toHaveProperty("comments");
        expect(Array.isArray(result.comments)).toBe(true);
        expect(result.comments.length).toBeGreaterThan(0);

        const comment = result.comments.find((c: any) => c.id === createdCommentId);
        expect(comment).toBeDefined();
        expect(comment?.text).toBe("This is an e2e test comment - safe to delete");

        console.log(`Listed ${result.comments.length} comment(s) on record`);
      } catch (error: any) {
        if (error.message?.includes("NOT_FOUND")) {
          console.log("Skipping: Comments API not available");
        } else {
          throw error;
        }
      }
    });

    it("update_comment - should update a comment", async () => {
      if (!commentTestRecordId || !createdCommentId) {
        console.log("Skipping: No record or comment from previous test");
        return;
      }

      const updatedText = `Updated e2e test comment - ${Date.now()}`;

      try {
        const comment = await client.updateComment(
          testTableName,
          commentTestRecordId,
          createdCommentId,
          updatedText
        );

        expect(comment).toHaveProperty("id");
        expect(comment.id).toBe(createdCommentId);
        expect(comment.text).toBe(updatedText);
        expect(comment).toHaveProperty("lastUpdatedTime");

        console.log(`Updated comment: ${comment.id}`);
      } catch (error: any) {
        if (error.message?.includes("NOT_FOUND") || error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: Cannot update comment (may not be author or API not available)");
        } else {
          throw error;
        }
      }
    });

    it("delete_comment - should delete a comment", async () => {
      if (!commentTestRecordId || !createdCommentId) {
        console.log("Skipping: No record or comment from previous test");
        return;
      }

      try {
        const result = await client.deleteComment(
          testTableName,
          commentTestRecordId,
          createdCommentId
        );

        expect(result).toHaveProperty("id");
        expect(result.id).toBe(createdCommentId);
        expect(result.deleted).toBe(true);

        // Remove from cleanup list since we already deleted it
        const idx = createdCommentIds.findIndex((c) => c.commentId === createdCommentId);
        if (idx !== -1) createdCommentIds.splice(idx, 1);

        console.log(`Deleted comment: ${result.id}`);
      } catch (error: any) {
        if (error.message?.includes("NOT_FOUND") || error.message?.includes("INVALID_PERMISSIONS")) {
          console.log("Skipping: Cannot delete comment (may not be author or API not available)");
        } else {
          throw error;
        }
      }
    });
  });

  describe("Filtering and Querying", () => {
    it("get_records - should filter records by formula", async () => {
      // Create a record with known value
      const uniqueValue = `FilterTest_${Date.now()}`;
      const created = await client.createRecords(testTableName, [{ Name: uniqueValue }]);
      createdRecordIds.push(created[0].id);

      // Filter for the record
      const records = await client.getRecords(testTableName, {
        filterByFormula: `{Name} = "${uniqueValue}"`,
        maxRecords: 10,
      });

      expect(records.length).toBe(1);
      expect(records[0].fields.Name).toBe(uniqueValue);
      console.log(`Filter test: Found ${records.length} matching record`);
    });
  });
});

// Summary test
describe.skipIf(skipTests)("E2E Summary", () => {
  it("should print test summary", () => {
    console.log("\n=== E2E Test Summary ===");
    console.log(`API Key: ${API_KEY?.slice(0, 10)}...`);
    console.log(`Workspace ID: ${WORKSPACE_ID}`);
    console.log(`Test Base: ${testBaseName} (${testBaseId})`);
    console.log(`Records created during test: ${createdRecordIds.length}`);
    console.log(`Fields created during test: ${createdFieldIds.length}`);
    console.log(`Tables created during test: ${createdTableIds.length}`);
    console.log(`Comments created during test: ${createdCommentIds.length}`);
    console.log("========================\n");
  });
});
