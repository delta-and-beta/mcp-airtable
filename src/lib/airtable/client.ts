/**
 * Airtable client wrapper
 * Provides typed methods for all Airtable API operations
 */

import Airtable from "airtable";
import { readFile } from "fs/promises";
import { AirtableError, ValidationError } from "../errors.js";
import { fetchWithDetails } from "./fetch.js";
import { guessContentType } from "./mime-types.js";
import type {
  AirtableRecord,
  AirtableBase,
  AirtableWorkspace,
  AirtableTable,
  AirtableField,
  AirtableComment,
  AirtableApiError,
  CommentsResponse,
  AttachmentUploadResult,
  DeletedRecord,
  CreateBaseOptions,
  CreateTableOptions,
  CreateFieldOptions,
  UpdateFieldOptions,
  UploadAttachmentOptions,
  ListCommentsOptions,
  GetRecordsOptions,
  RecordOptions,
} from "./types.js";

export class AirtableClient {
  private airtable: Airtable;
  private apiKey: string;
  private baseId?: string;

  constructor(apiKey: string, baseId?: string) {
    this.apiKey = apiKey;
    this.airtable = new Airtable({ apiKey });
    this.baseId = baseId;
  }

  // ============================================================================
  // BASES API
  // ============================================================================

  async listBases(): Promise<AirtableBase[]> {
    const response = await fetchWithDetails("https://api.airtable.com/v0/meta/bases", {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new AirtableError(
        `Failed to list bases: ${response.statusText}`,
        response.status,
        { endpoint: "listBases" }
      );
    }

    const data = (await response.json()) as { bases?: AirtableBase[] };
    return data.bases || [];
  }

  async listWorkspaces(): Promise<AirtableWorkspace[]> {
    const response = await fetchWithDetails("https://api.airtable.com/v0/meta/workspaces", {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        errorData.error?.message || `Failed to list workspaces: ${response.statusText}`,
        response.status,
        { endpoint: "listWorkspaces" }
      );
    }

    const data = (await response.json()) as { workspaces?: AirtableWorkspace[] };
    return data.workspaces || [];
  }

  async createBase(options: CreateBaseOptions): Promise<{
    id: string;
    tables: AirtableTable[];
  }> {
    if (!options.tables || options.tables.length === 0) {
      throw new ValidationError("At least one table is required when creating a base");
    }

    const response = await fetchWithDetails("https://api.airtable.com/v0/meta/bases", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: options.name,
        workspaceId: options.workspaceId,
        tables: options.tables,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        `Failed to create base: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "createBase", name: options.name }
      );
    }

    return await response.json();
  }

  // ============================================================================
  // TABLES API
  // ============================================================================

  async listTables(baseId?: string): Promise<AirtableTable[]> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const response = await fetchWithDetails(
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

    const data = (await response.json()) as { tables?: AirtableTable[] };
    return data.tables || [];
  }

  async createTable(baseId: string, table: CreateTableOptions): Promise<AirtableTable> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    if (!table.fields || table.fields.length === 0) {
      throw new ValidationError("At least one field is required when creating a table");
    }

    const body: Record<string, unknown> = {
      name: table.name,
      fields: table.fields,
    };
    if (table.description) body.description = table.description;

    const response = await fetchWithDetails(
      `https://api.airtable.com/v0/meta/bases/${bid}/tables`,
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
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        `Failed to create table: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "createTable", baseId: bid, tableName: table.name }
      );
    }

    return await response.json();
  }

  async updateTable(
    baseId: string,
    tableIdOrName: string,
    updates: { name?: string; description?: string }
  ): Promise<AirtableTable> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    if (!updates.name && updates.description === undefined) {
      throw new ValidationError("At least one of name or description must be provided");
    }

    const body: Record<string, unknown> = {};
    if (updates.name) body.name = updates.name;
    if (updates.description !== undefined) body.description = updates.description;

    const response = await fetchWithDetails(
      `https://api.airtable.com/v0/meta/bases/${bid}/tables/${encodeURIComponent(tableIdOrName)}`,
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
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        `Failed to update table: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "updateTable", baseId: bid, tableIdOrName }
      );
    }

    return await response.json();
  }

  // ============================================================================
  // RECORDS API
  // ============================================================================

  async getRecords(tableName: string, options: GetRecordsOptions = {}): Promise<AirtableRecord[]> {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const queryOptions: Record<string, unknown> = {};
    if (options.filterByFormula) queryOptions.filterByFormula = options.filterByFormula;
    if (options.maxRecords) queryOptions.maxRecords = options.maxRecords;

    const records = await table.select(queryOptions).all();

    return records.map((r: any) => ({
      id: r.id,
      fields: r.fields as Record<string, unknown>,
      createdTime: r._rawJson?.createdTime,
    }));
  }

  async createRecord(
    tableName: string,
    fields: Record<string, unknown>,
    options: RecordOptions = {}
  ): Promise<AirtableRecord> {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    // Use 'as any' to work around Airtable SDK's restrictive FieldSet typing
    const record: any = await table.create(fields as any, { typecast: options.typecast });

    return {
      id: record.id,
      fields: record.fields as Record<string, unknown>,
      createdTime: record._rawJson?.createdTime,
    };
  }

  async createRecords(
    tableName: string,
    records: Array<Record<string, unknown>>,
    options: RecordOptions = {}
  ): Promise<AirtableRecord[]> {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const results: AirtableRecord[] = [];
    const BATCH_SIZE = 10;
    const RATE_LIMIT_DELAY = 100;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
      }

      const chunk = records.slice(i, i + BATCH_SIZE);
      const recordsToCreate = chunk.map((fields) => ({ fields }));
      // Use 'as any' to work around Airtable SDK's restrictive FieldSet typing
      const created = await table.create(recordsToCreate as any, {
        typecast: options.typecast,
      });
      const createdArray = Array.isArray(created) ? created : [created];

      results.push(
        ...createdArray.map((r: any) => ({
          id: r.id,
          fields: r.fields as Record<string, unknown>,
          createdTime: r._rawJson?.createdTime,
        }))
      );
    }

    return results;
  }

  async updateRecord(
    tableName: string,
    recordId: string,
    fields: Record<string, unknown>,
    options: RecordOptions = {}
  ): Promise<AirtableRecord> {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    // Use 'as any' to work around Airtable SDK's restrictive FieldSet typing
    const record = await table.update(recordId, fields as any, { typecast: options.typecast });

    return {
      id: record.id,
      fields: record.fields as Record<string, unknown>,
      createdTime: (record as any)._rawJson?.createdTime,
    };
  }

  async getRecord(tableName: string, recordId: string, baseId?: string): Promise<AirtableRecord> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const record = await table.find(recordId);

    return {
      id: record.id,
      fields: record.fields as Record<string, unknown>,
      createdTime: (record as any)._rawJson?.createdTime,
    };
  }

  async deleteRecord(tableName: string, recordId: string, baseId?: string): Promise<DeletedRecord> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const base = this.airtable.base(bid);
    const table = base(tableName);

    const result = await table.destroy(recordId);

    return {
      id: result.id,
      deleted: true,
    };
  }

  // ============================================================================
  // FIELDS API
  // ============================================================================

  async createField(
    tableIdOrName: string,
    field: CreateFieldOptions,
    baseId?: string
  ): Promise<AirtableField> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const body: Record<string, unknown> = {
      name: field.name,
      type: field.type,
    };
    if (field.description) body.description = field.description;
    if (field.options) body.options = field.options;

    const response = await fetchWithDetails(
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
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        `Failed to create field: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "createField", tableIdOrName, field: field.name }
      );
    }

    return await response.json();
  }

  async updateField(
    tableIdOrName: string,
    fieldIdOrName: string,
    updates: UpdateFieldOptions,
    baseId?: string
  ): Promise<AirtableField> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    if (!updates.name && !updates.description) {
      throw new ValidationError("At least one of name or description must be provided");
    }

    const body: Record<string, unknown> = {};
    if (updates.name) body.name = updates.name;
    if (updates.description !== undefined) body.description = updates.description;

    const response = await fetchWithDetails(
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
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        `Failed to update field: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "updateField", tableIdOrName, fieldIdOrName }
      );
    }

    return await response.json();
  }

  // ============================================================================
  // ATTACHMENTS API
  // ============================================================================

  async uploadAttachment(
    recordId: string,
    fieldIdOrName: string,
    options: UploadAttachmentOptions
  ): Promise<AttachmentUploadResult> {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    if (!options.filePath && !options.base64Data) {
      throw new ValidationError("Either filePath or base64Data must be provided");
    }
    if (options.base64Data && !options.filename) {
      throw new ValidationError("filename is required when using base64Data");
    }

    let base64Content: string;
    let filename: string;
    let contentType: string;

    if (options.filePath) {
      try {
        const fileBuffer = await readFile(options.filePath);
        base64Content = fileBuffer.toString("base64");
      } catch (err) {
        throw new ValidationError(`Failed to read file: ${(err as Error).message}`);
      }
      filename = options.filename || options.filePath.split("/").pop() || "file";
      contentType = options.contentType || guessContentType(filename);
    } else {
      base64Content = options.base64Data!;
      filename = options.filename!;
      contentType = options.contentType || guessContentType(filename);
    }

    const url = `https://content.airtable.com/v0/${bid}/${recordId}/${encodeURIComponent(fieldIdOrName)}/uploadAttachment`;

    const response = await fetchWithDetails(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentType,
        file: base64Content,
        filename,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorData = JSON.parse(errorText) as AirtableApiError;
        errorMessage = errorData.error?.message || response.statusText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      throw new AirtableError(
        `Failed to upload attachment: ${errorMessage}`,
        response.status,
        { endpoint: "uploadAttachment", recordId, fieldIdOrName }
      );
    }

    return await response.json();
  }

  // ============================================================================
  // COMMENTS API
  // ============================================================================

  async listComments(
    tableIdOrName: string,
    recordId: string,
    options: ListCommentsOptions = {}
  ): Promise<CommentsResponse> {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const params = new URLSearchParams();
    if (options.offset) params.set("offset", options.offset);
    if (options.pageSize) params.set("pageSize", String(options.pageSize));

    const queryString = params.toString();
    const url = `https://api.airtable.com/v0/${bid}/${encodeURIComponent(tableIdOrName)}/${recordId}/comments${queryString ? `?${queryString}` : ""}`;

    const response = await fetchWithDetails(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        `Failed to list comments: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "listComments", tableIdOrName, recordId }
      );
    }

    return await response.json();
  }

  async createComment(
    tableIdOrName: string,
    recordId: string,
    text: string,
    baseId?: string
  ): Promise<AirtableComment> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const url = `https://api.airtable.com/v0/${bid}/${encodeURIComponent(tableIdOrName)}/${recordId}/comments`;

    const response = await fetchWithDetails(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        `Failed to create comment: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "createComment", tableIdOrName, recordId }
      );
    }

    return await response.json();
  }

  async updateComment(
    tableIdOrName: string,
    recordId: string,
    commentId: string,
    text: string,
    baseId?: string
  ): Promise<AirtableComment & { lastUpdatedTime: string }> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const url = `https://api.airtable.com/v0/${bid}/${encodeURIComponent(tableIdOrName)}/${recordId}/comments/${commentId}`;

    const response = await fetchWithDetails(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        `Failed to update comment: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "updateComment", tableIdOrName, recordId, commentId }
      );
    }

    return await response.json();
  }

  async deleteComment(
    tableIdOrName: string,
    recordId: string,
    commentId: string,
    baseId?: string
  ): Promise<DeletedRecord> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const url = `https://api.airtable.com/v0/${bid}/${encodeURIComponent(tableIdOrName)}/${recordId}/comments/${commentId}`;

    const response = await fetchWithDetails(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as AirtableApiError;
      throw new AirtableError(
        `Failed to delete comment: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "deleteComment", tableIdOrName, recordId, commentId }
      );
    }

    return { id: commentId, deleted: true };
  }
}
