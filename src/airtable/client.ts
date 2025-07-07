import Airtable from 'airtable';
import type { FieldSet } from 'airtable';

export interface AirtableConfig {
  apiKey: string;
  baseId?: string;
}

export class AirtableClient {
  private airtable: Airtable;
  private apiKey: string;
  private defaultBaseId?: string;

  constructor(config: AirtableConfig) {
    if (!config.apiKey) {
      throw new Error('Airtable API key is required');
    }

    console.log('[DEBUG] AirtableClient constructor:', {
      apiKeyLength: config.apiKey.length,
      apiKeyPrefix: config.apiKey.substring(0, 10) + '...',
      hasBaseId: !!config.baseId
    });

    this.apiKey = config.apiKey;
    this.airtable = new Airtable({ apiKey: config.apiKey });
    this.defaultBaseId = config.baseId;
  }

  private getBase(baseId?: string) {
    const id = baseId || this.defaultBaseId;
    if (!id) {
      throw new Error('Base ID is required');
    }
    return this.airtable.base(id);
  }

  async listBases() {
    const response = await fetch('https://api.airtable.com/v0/meta/bases', {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list bases: ${response.statusText}`);
    }

    return response.json();
  }

  async listTables(baseId?: string) {
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${baseId || this.defaultBaseId}/tables`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list tables: ${response.statusText}`);
    }

    return response.json();
  }

  async listViews(tableName: string, baseId?: string) {
    // First get the base schema to find the table
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${baseId || this.defaultBaseId}/tables`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get table information: ${response.statusText}`);
    }

    const data: any = await response.json();
    const table = data.tables?.find((t: any) => t.name === tableName || t.id === tableName);
    
    if (!table) {
      throw new Error(`Table '${tableName}' not found`);
    }

    // Return views from the table
    return {
      tableId: table.id,
      tableName: table.name,
      views: table.views || []
    };
  }

  async getRecords(
    tableName: string,
    options: {
      baseId?: string;
      view?: string;
      maxRecords?: number;
      filterByFormula?: string;
      sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
      fields?: string[];
    } = {}
  ) {
    const base = this.getBase(options.baseId);
    const table = base(tableName);

    const selectOptions: {
      view?: string;
      maxRecords?: number;
      filterByFormula?: string;
      sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
      fields?: string[];
    } = {};
    
    if (options.view) selectOptions.view = options.view;
    if (options.maxRecords) selectOptions.maxRecords = options.maxRecords;
    if (options.filterByFormula) selectOptions.filterByFormula = options.filterByFormula;
    if (options.sort) selectOptions.sort = options.sort;
    if (options.fields) selectOptions.fields = options.fields;

    const records = await table.select(selectOptions).all();
    return records.map((record) => ({
      id: record.id,
      fields: record.fields,
      createdTime: (record as any)._rawJson?.createdTime || new Date().toISOString(),
    }));
  }

  async createRecord(
    tableName: string,
    fields: FieldSet,
    options: { baseId?: string; typecast?: boolean } = {}
  ) {
    const base = this.getBase(options.baseId);
    const table = base(tableName);

    const createOptions: any = {};
    if (options.typecast !== undefined) {
      createOptions.typecast = options.typecast;
    }

    const record = await table.create(fields, createOptions);
    return {
      id: record.id,
      fields: record.fields,
      createdTime: (record as any)._rawJson?.createdTime || new Date().toISOString(),
    };
  }

  async updateRecord(
    tableName: string,
    recordId: string,
    fields: FieldSet,
    options: { baseId?: string; typecast?: boolean } = {}
  ) {
    const base = this.getBase(options.baseId);
    const table = base(tableName);

    const updateOptions: any = {};
    if (options.typecast !== undefined) {
      updateOptions.typecast = options.typecast;
    }

    const record = await table.update(recordId, fields, updateOptions);
    return {
      id: record.id,
      fields: record.fields,
      createdTime: (record as any)._rawJson?.createdTime || new Date().toISOString(),
    };
  }

  async deleteRecord(
    tableName: string,
    recordId: string,
    options: { baseId?: string } = {}
  ) {
    const base = this.getBase(options.baseId);
    const table = base(tableName);

    const record = await table.destroy(recordId);
    return {
      id: record.id,
      deleted: true,
    };
  }

  async getSchema(baseId?: string) {
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${baseId || this.defaultBaseId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get schema: ${response.statusText}`);
    }

    return response.json();
  }

  async batchCreate(
    tableName: string,
    records: Array<{ fields: FieldSet }>,
    options: {
      baseId?: string;
      typecast?: boolean;
    } = {}
  ) {
    const base = this.getBase(options.baseId);
    const table = base(tableName);

    const createOptions: any = {};
    if (options.typecast !== undefined) {
      createOptions.typecast = options.typecast;
    }

    // Airtable API supports batch operations in chunks of 10
    const chunks = [];
    for (let i = 0; i < records.length; i += 10) {
      chunks.push(records.slice(i, i + 10));
    }

    const results = [];
    for (const chunk of chunks) {
      // For batch create, pass the array of records with fields
      const createdRecords = await table.create(chunk, createOptions);
      
      // Ensure createdRecords is always an array
      const recordsArray = Array.isArray(createdRecords) ? createdRecords : [createdRecords];
      
      results.push(...recordsArray.map(record => ({
        id: record.id,
        fields: record.fields,
        createdTime: (record as any)._rawJson?.createdTime || new Date().toISOString(),
      })));
    }

    return results;
  }

  async batchUpdate(
    tableName: string,
    records: Array<{ id: string; fields: FieldSet }>,
    options: {
      baseId?: string;
      typecast?: boolean;
    } = {}
  ) {
    const base = this.getBase(options.baseId);
    const table = base(tableName);

    const updateOptions: any = {};
    if (options.typecast !== undefined) {
      updateOptions.typecast = options.typecast;
    }

    // Airtable API supports batch operations in chunks of 10
    const chunks = [];
    for (let i = 0; i < records.length; i += 10) {
      chunks.push(records.slice(i, i + 10));
    }

    const results = [];
    for (const chunk of chunks) {
      // For batch update, Airtable expects array of {id, fields} objects
      const updatedRecords = await table.update(chunk, updateOptions);
      
      // Ensure updatedRecords is always an array
      const recordsArray = Array.isArray(updatedRecords) ? updatedRecords : [updatedRecords];
      
      results.push(...recordsArray.map(record => ({
        id: record.id,
        fields: record.fields,
        createdTime: (record as any)._rawJson?.createdTime || new Date().toISOString(),
      })));
    }

    return results;
  }

  async batchUpsert(
    tableName: string,
    records: Array<{ fields: FieldSet; id?: string }>,
    options: {
      baseId?: string;
      typecast?: boolean;
      performUpsert?: {
        fieldsToMergeOn: string[];
      };
    } = {}
  ) {
    const base = this.getBase(options.baseId);
    const table = base(tableName);

    const createOptions: any = {};
    if (options.typecast !== undefined) {
      createOptions.typecast = options.typecast;
    }
    if (options.performUpsert) {
      createOptions.performUpsert = options.performUpsert;
    }

    // Airtable API supports batch operations in chunks of 10
    const chunks = [];
    for (let i = 0; i < records.length; i += 10) {
      chunks.push(records.slice(i, i + 10));
    }

    const results = [];
    for (const chunk of chunks) {
      // For upsert, pass records with fields (SDK will handle the upsert logic)
      const createdRecords = await table.create(
        chunk.map(r => ({ fields: r.fields })),
        createOptions
      );
      
      // Ensure createdRecords is always an array
      const recordsArray = Array.isArray(createdRecords) ? createdRecords : [createdRecords];
      
      results.push(...recordsArray.map(record => ({
        id: record.id,
        fields: record.fields,
        createdTime: (record as any)._rawJson?.createdTime || new Date().toISOString(),
      })));
    }

    return results;
  }

  async batchDelete(
    tableName: string,
    recordIds: string[],
    options: {
      baseId?: string;
    } = {}
  ) {
    const base = this.getBase(options.baseId);
    const table = base(tableName);

    // Airtable API supports batch delete in chunks of 10
    const chunks = [];
    for (let i = 0; i < recordIds.length; i += 10) {
      chunks.push(recordIds.slice(i, i + 10));
    }

    const results = [];
    for (const chunk of chunks) {
      const deletedRecords = await table.destroy(chunk);
      
      // Ensure deletedRecords is always an array
      const recordsArray = Array.isArray(deletedRecords) ? deletedRecords : [deletedRecords];
      
      results.push(...recordsArray.map(record => ({
        id: record.id,
        deleted: true,
      })));
    }

    return results;
  }

  async createTable(
    name: string,
    fields: Array<{
      name: string;
      type: string;
      options?: Record<string, any>;
      description?: string;
    }>,
    options: {
      baseId?: string;
      description?: string;
    } = {}
  ) {
    const baseId = options.baseId || this.defaultBaseId;
    if (!baseId) {
      throw new Error('Base ID is required for creating tables');
    }

    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: options.description,
          fields: fields.map(field => ({
            name: field.name,
            type: field.type,
            options: field.options,
            description: field.description,
          })),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create table: ${response.statusText} - ${error}`);
    }

    return response.json();
  }

  async updateTable(
    tableIdOrName: string,
    updates: {
      name?: string;
      description?: string;
    },
    options: {
      baseId?: string;
    } = {}
  ) {
    const baseId = options.baseId || this.defaultBaseId;
    if (!baseId) {
      throw new Error('Base ID is required for updating tables');
    }

    // First, get the table ID if a name was provided
    let tableId = tableIdOrName;
    if (!tableIdOrName.startsWith('tbl')) {
      // If it doesn't look like a table ID, try to find it by name
      const tablesResponse = await this.listTables(baseId) as any;
      const table = tablesResponse.tables?.find((t: any) => t.name === tableIdOrName);
      if (!table) {
        throw new Error(`Table '${tableIdOrName}' not found`);
      }
      tableId = table.id;
    }

    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update table: ${response.statusText} - ${error}`);
    }

    return response.json();
  }
}