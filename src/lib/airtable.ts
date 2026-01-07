/**
 * Simplified Airtable client wrapper
 */

import Airtable from "airtable";
import { AirtableError, ValidationError } from "./errors.js";

export class AirtableClient {
  private airtable: Airtable;
  private apiKey: string;
  private baseId?: string;

  constructor(apiKey: string, baseId?: string) {
    this.apiKey = apiKey;
    this.airtable = new Airtable({ apiKey });
    this.baseId = baseId;
  }

  async listBases() {
    const response = await fetch("https://api.airtable.com/v0/meta/bases", {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new AirtableError(
        `Failed to list bases: ${response.statusText}`,
        response.status,
        { endpoint: "listBases" }
      );
    }

    const data: any = await response.json();
    return data.bases || [];
  }

  async listTables(baseId?: string) {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${bid}/tables`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      }
    );

    if (!response.ok) {
      throw new AirtableError(
        `Failed to list tables: ${response.statusText}`,
        response.status,
        { endpoint: "listTables", baseId: bid }
      );
    }

    const data: any = await response.json();
    return data.tables || [];
  }

  async getRecords(
    tableName: string,
    options: { baseId?: string; filterByFormula?: string; maxRecords?: number } = {}
  ) {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const queryOptions: any = {};
    if (options.filterByFormula) queryOptions.filterByFormula = options.filterByFormula;
    if (options.maxRecords) queryOptions.maxRecords = options.maxRecords;

    const records = await table.select(queryOptions).all();

    return records.map((r: any) => ({
      id: r.id,
      fields: r.fields,
      createdTime: r._rawJson?.createdTime,
    }));
  }

  async createRecord(
    tableName: string,
    fields: any,
    options: { baseId?: string; typecast?: boolean } = {}
  ) {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const record: any = await table.create(fields, { typecast: options.typecast });

    return {
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson?.createdTime,
    };
  }

  /**
   * Create multiple records with auto-batching (10 per request, 100ms delay)
   * @param tableName - Table name
   * @param records - Array of field objects to create
   * @param options - Optional baseId and typecast settings
   * @returns Array of created records
   */
  async createRecords(
    tableName: string,
    records: Array<Record<string, unknown>>,
    options: { baseId?: string; typecast?: boolean } = {}
  ) {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const results: Array<{ id: string; fields: Record<string, unknown>; createdTime?: string }> = [];
    const BATCH_SIZE = 10;
    const RATE_LIMIT_DELAY = 100; // 100ms between batches

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      // Add delay between batches (not before the first batch)
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
      }

      const chunk = records.slice(i, i + BATCH_SIZE);
      // Airtable SDK bulk create expects {fields: {...}} format
      const recordsToCreate = chunk.map((fields) => ({ fields }));
      const created: any = await table.create(recordsToCreate as any, { typecast: options.typecast });
      const createdArray = Array.isArray(created) ? created : [created];

      results.push(
        ...createdArray.map((r: any) => ({
          id: r.id,
          fields: r.fields,
          createdTime: r._rawJson?.createdTime,
        }))
      );
    }

    return results;
  }

  async updateRecord(
    tableName: string,
    recordId: string,
    fields: any,
    options: { baseId?: string; typecast?: boolean } = {}
  ) {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const record: any = await table.update(recordId, fields, { typecast: options.typecast });

    return {
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson?.createdTime,
    };
  }

  async getRecord(tableName: string, recordId: string, baseId?: string) {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const record: any = await table.find(recordId);

    return {
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson?.createdTime,
    };
  }

  async deleteRecord(tableName: string, recordId: string, baseId?: string) {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const result: any = await table.destroy(recordId);

    return {
      id: result.id,
      deleted: true,
    };
  }

  /**
   * Create a new field in a table
   * POST /v0/meta/bases/{baseId}/tables/{tableIdOrName}/fields
   */
  async createField(
    tableIdOrName: string,
    field: {
      name: string;
      type: string;
      description?: string;
      options?: Record<string, unknown>;
    },
    baseId?: string
  ) {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const body: Record<string, unknown> = {
      name: field.name,
      type: field.type,
    };
    if (field.description) body.description = field.description;
    if (field.options) body.options = field.options;

    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${bid}/tables/${encodeURIComponent(tableIdOrName)}/fields`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to create field: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "createField", tableIdOrName, field: field.name }
      );
    }

    return await response.json();
  }

  /**
   * Update a field's name or description
   * PATCH /v0/meta/bases/{baseId}/tables/{tableIdOrName}/fields/{fieldIdOrName}
   * Note: Cannot change field type or options
   */
  async updateField(
    tableIdOrName: string,
    fieldIdOrName: string,
    updates: { name?: string; description?: string },
    baseId?: string
  ) {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    if (!updates.name && !updates.description) {
      throw new ValidationError("At least one of name or description must be provided");
    }

    const body: Record<string, unknown> = {};
    if (updates.name) body.name = updates.name;
    if (updates.description !== undefined) body.description = updates.description;

    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${bid}/tables/${encodeURIComponent(tableIdOrName)}/fields/${encodeURIComponent(fieldIdOrName)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to update field: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "updateField", tableIdOrName, fieldIdOrName }
      );
    }

    return await response.json();
  }
}
