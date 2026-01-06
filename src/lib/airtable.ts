/**
 * Simplified Airtable client wrapper
 */

import Airtable from "airtable";

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
      throw new Error(`Failed to list bases: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.bases || [];
  }

  async listTables(baseId?: string) {
    const bid = baseId || this.baseId;
    if (!bid) throw new Error("Base ID required");

    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${bid}/tables`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list tables: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.tables || [];
  }

  async getRecords(
    tableName: string,
    options: { baseId?: string; filterByFormula?: string; maxRecords?: number } = {}
  ) {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new Error("Base ID required");

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
    if (!bid) throw new Error("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const record: any = await table.create(fields, { typecast: options.typecast });

    return {
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson?.createdTime,
    };
  }

  async updateRecord(
    tableName: string,
    recordId: string,
    fields: any,
    options: { baseId?: string; typecast?: boolean } = {}
  ) {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new Error("Base ID required");

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
    if (!bid) throw new Error("Base ID required");

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
    if (!bid) throw new Error("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const result: any = await table.destroy(recordId);

    return {
      id: result.id,
      deleted: true,
    };
  }
}
