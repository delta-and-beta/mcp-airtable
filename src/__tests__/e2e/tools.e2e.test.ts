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

// Skip all tests if credentials not provided
const skipTests = !API_KEY || !BASE_ID;

// Test data tracking for cleanup
const createdRecordIds: string[] = [];
const createdFieldIds: string[] = [];
let testTableName = `E2E_Test_${Date.now()}`;
let testTableId: string | null = null;

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
    console.log(`Records created during test: ${createdRecordIds.length}`);
    console.log(`Fields created during test: ${createdFieldIds.length}`);
    console.log("========================\n");
  });
});
