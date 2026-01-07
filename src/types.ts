/**
 * Shared type definitions for MCP Airtable
 */

// Airtable record types
export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

export interface DeletedRecord {
  id: string;
  deleted: true;
}

// Batch operation types
export interface BatchFailure {
  chunkIndex: number;
  error: string;
  recordIds: string[];
}

export interface BatchSummary {
  total: number;
  succeeded: number;
  failed: number;
}

// API response types
export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields?: AirtableField[];
  views?: AirtableView[];
}

export interface AirtableField {
  id: string;
  name: string;
  type: string;
  options?: Record<string, unknown>;
}

export interface AirtableView {
  id: string;
  name: string;
  type: string;
}

// Context types for MCP
export interface MCPContext {
  request?: {
    headers?: Record<string, string | string[]>;
  };
}
