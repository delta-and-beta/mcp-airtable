/**
 * Simplified Airtable client wrapper
 */

import Airtable from "airtable";
import { readFile } from "fs/promises";
import { AirtableError, ValidationError } from "./errors.js";
import { logger } from "./logger.js";

/**
 * Wrap fetch with detailed error handling for debugging network issues
 */
async function fetchWithDetails(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error: any) {
    // Extract detailed error info for debugging
    const cause = error.cause;
    const errorDetails = {
      message: error.message,
      code: cause?.code,
      errno: cause?.errno,
      syscall: cause?.syscall,
      hostname: cause?.hostname,
    };
    logger.error("Fetch failed", { url, errorDetails });

    // Provide more helpful error message
    let detailedMessage = error.message;
    if (cause?.code === "ENOTFOUND") {
      detailedMessage = `DNS lookup failed for ${cause.hostname || url}`;
    } else if (cause?.code === "ECONNREFUSED") {
      detailedMessage = `Connection refused to ${url}`;
    } else if (cause?.code === "CERT_HAS_EXPIRED" || cause?.code?.includes("CERT")) {
      detailedMessage = `TLS certificate error: ${cause.code}`;
    }

    throw new Error(`${detailedMessage} [${cause?.code || "UNKNOWN"}]`);
  }
}

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

    const data: any = await response.json();
    return data.bases || [];
  }

  async listTables(baseId?: string) {
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
   * Create a new base
   * POST /v0/meta/bases
   */
  async createBase(options: {
    name: string;
    workspaceId: string;
    tables: Array<{
      name: string;
      description?: string;
      fields: Array<{
        name: string;
        type: string;
        description?: string;
        options?: Record<string, unknown>;
      }>;
    }>;
  }): Promise<{
    id: string;
    tables: Array<{
      id: string;
      name: string;
      primaryFieldId: string;
      fields: Array<{ id: string; name: string; type: string }>;
      views: Array<{ id: string; name: string; type: string }>;
    }>;
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
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to create base: ${(errorData as any).error?.message || response.statusText}`,
        response.status,
        { endpoint: "createBase", name: options.name }
      );
    }

    return await response.json();
  }

  /**
   * Create a new table in a base
   * POST /v0/meta/bases/{baseId}/tables
   */
  async createTable(
    baseId: string,
    table: {
      name: string;
      description?: string;
      fields: Array<{
        name: string;
        type: string;
        description?: string;
        options?: Record<string, unknown>;
      }>;
    }
  ): Promise<{
    id: string;
    name: string;
    primaryFieldId: string;
    fields: Array<{ id: string; name: string; type: string }>;
    views: Array<{ id: string; name: string; type: string }>;
  }> {
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
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to create table: ${(errorData as any).error?.message || response.statusText}`,
        response.status,
        { endpoint: "createTable", baseId: bid, tableName: table.name }
      );
    }

    return await response.json();
  }

  /**
   * Update a table's name or description
   * PATCH /v0/meta/bases/{baseId}/tables/{tableIdOrName}
   * Note: Cannot change table fields - use createField/updateField for that
   */
  async updateTable(
    baseId: string,
    tableIdOrName: string,
    updates: { name?: string; description?: string }
  ): Promise<{
    id: string;
    name: string;
    primaryFieldId: string;
    fields: Array<{ id: string; name: string; type: string }>;
    views: Array<{ id: string; name: string; type: string }>;
    description?: string;
  }> {
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
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to update table: ${(errorData as any).error?.message || response.statusText}`,
        response.status,
        { endpoint: "updateTable", baseId: bid, tableIdOrName }
      );
    }

    return await response.json();
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
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to update field: ${errorData.error?.message || response.statusText}`,
        response.status,
        { endpoint: "updateField", tableIdOrName, fieldIdOrName }
      );
    }

    return await response.json();
  }

  /**
   * Upload an attachment to a record's attachment field
   * POST https://content.airtable.com/v0/{baseId}/{recordId}/{fieldIdOrName}/uploadAttachment
   *
   * Note: The endpoint does NOT include table ID - only baseId, recordId, and fieldIdOrName
   *
   * Supports two input methods:
   * 1. filePath - Upload from local file system
   * 2. base64Data + filename - Upload from base64-encoded content
   */
  async uploadAttachment(
    recordId: string,
    fieldIdOrName: string,
    options: {
      baseId?: string;
      filePath?: string;
      base64Data?: string;
      filename?: string;
      contentType?: string;
    }
  ): Promise<{
    id: string;
    createdTime: string;
    fields: Record<string, unknown>;
  }> {
    const bid = options.baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    // Validate input: must provide either filePath OR (base64Data + filename)
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
      // Read file from disk and encode to base64
      try {
        const fileBuffer = await readFile(options.filePath);
        base64Content = fileBuffer.toString("base64");
      } catch (err: any) {
        throw new ValidationError(`Failed to read file: ${err.message}`);
      }
      // Extract filename from path
      filename = options.filename || options.filePath.split("/").pop() || "file";
      contentType = options.contentType || this.guessContentType(filename);
    } else {
      // Use provided base64 data directly
      base64Content = options.base64Data!;
      filename = options.filename!;
      contentType = options.contentType || this.guessContentType(filename);
    }

    // Upload to Airtable Content API with JSON body
    // Endpoint format: POST /v0/{baseId}/{recordId}/{fieldIdOrName}/uploadAttachment
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
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.error || response.statusText;
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

  /**
   * List comments on a record
   * GET /v0/{baseId}/{tableIdOrName}/{recordId}/comments
   */
  async listComments(
    tableIdOrName: string,
    recordId: string,
    options: { baseId?: string; offset?: string; pageSize?: number } = {}
  ): Promise<{
    comments: Array<{
      id: string;
      author: { id: string; email: string; name?: string };
      text: string;
      createdTime: string;
      lastUpdatedTime?: string;
    }>;
    offset?: string;
  }> {
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
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to list comments: ${(errorData as any).error?.message || response.statusText}`,
        response.status,
        { endpoint: "listComments", tableIdOrName, recordId }
      );
    }

    return await response.json();
  }

  /**
   * Create a comment on a record
   * POST /v0/{baseId}/{tableIdOrName}/{recordId}/comments
   *
   * Supports user mentions with format: @[usrXXXXXXXXXXXXXX]
   */
  async createComment(
    tableIdOrName: string,
    recordId: string,
    text: string,
    baseId?: string
  ): Promise<{
    id: string;
    author: { id: string; email: string; name?: string };
    text: string;
    createdTime: string;
  }> {
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
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to create comment: ${(errorData as any).error?.message || response.statusText}`,
        response.status,
        { endpoint: "createComment", tableIdOrName, recordId }
      );
    }

    return await response.json();
  }

  /**
   * Update a comment
   * PATCH /v0/{baseId}/{tableIdOrName}/{recordId}/comments/{commentId}
   */
  async updateComment(
    tableIdOrName: string,
    recordId: string,
    commentId: string,
    text: string,
    baseId?: string
  ): Promise<{
    id: string;
    author: { id: string; email: string; name?: string };
    text: string;
    createdTime: string;
    lastUpdatedTime: string;
  }> {
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
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to update comment: ${(errorData as any).error?.message || response.statusText}`,
        response.status,
        { endpoint: "updateComment", tableIdOrName, recordId, commentId }
      );
    }

    return await response.json();
  }

  /**
   * Delete a comment
   * DELETE /v0/{baseId}/{tableIdOrName}/{recordId}/comments/{commentId}
   */
  async deleteComment(
    tableIdOrName: string,
    recordId: string,
    commentId: string,
    baseId?: string
  ): Promise<{ id: string; deleted: true }> {
    const bid = baseId || this.baseId;
    if (!bid) throw new ValidationError("Base ID required");

    const url = `https://api.airtable.com/v0/${bid}/${encodeURIComponent(tableIdOrName)}/${recordId}/comments/${commentId}`;

    const response = await fetchWithDetails(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AirtableError(
        `Failed to delete comment: ${(errorData as any).error?.message || response.statusText}`,
        response.status,
        { endpoint: "deleteComment", tableIdOrName, recordId, commentId }
      );
    }

    return { id: commentId, deleted: true };
  }

  /**
   * Guess content type from filename extension
   */
  private guessContentType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    const mimeTypes: Record<string, string> = {
      // Images
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      // Documents
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // Text
      txt: "text/plain",
      csv: "text/csv",
      json: "application/json",
      html: "text/html",
      // Audio/Video
      mp3: "audio/mpeg",
      wav: "audio/wav",
      mp4: "video/mp4",
      webm: "video/webm",
      // Archives
      zip: "application/zip",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }
}
