/**
 * Authentication and configuration extraction utilities
 * Priority: headers > parameter > environment variable
 */

import { AuthenticationError } from "./errors.js";

/**
 * Extract workspace ID from headers, args, or environment
 * Returns undefined if not found (optional field)
 */
export function extractWorkspaceId(
  args: { workspaceId?: string },
  context?: any
): string | undefined {
  // 1. HTTP headers (highest priority - set once during session init)
  const headers = context?.session?.headers;

  if (headers) {
    const workspaceHeader =
      headers["x-airtable-workspace-id"] ||
      headers["X-Airtable-Workspace-Id"] ||
      headers["X-AIRTABLE-WORKSPACE-ID"];

    if (workspaceHeader) {
      return Array.isArray(workspaceHeader) ? workspaceHeader[0] : workspaceHeader;
    }
  }

  // 2. Tool parameter
  if (args.workspaceId) {
    return args.workspaceId;
  }

  // 3. Environment variable (fallback)
  if (process.env.AIRTABLE_WORKSPACE_ID) {
    return process.env.AIRTABLE_WORKSPACE_ID;
  }

  return undefined;
}

export function extractApiKey(
  args: { airtableApiKey?: string },
  context?: any
): string {
  // 1. HTTP headers (highest priority - set once during session init)
  const headers = context?.session?.headers;

  if (headers) {
    // Try x-airtable-api-key (case-insensitive)
    const apiKeyHeader =
      headers["x-airtable-api-key"] ||
      headers["X-Airtable-Api-Key"] ||
      headers["X-AIRTABLE-API-KEY"];

    if (apiKeyHeader) {
      return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    }

    // Try Authorization: Bearer <token>
    const auth = headers["authorization"] || headers["Authorization"];
    if (auth) {
      const authStr = Array.isArray(auth) ? auth[0] : auth;
      if (authStr.startsWith("Bearer ")) {
        return authStr.substring(7);
      }
    }
  }

  // 2. Tool parameter (override for single call)
  if (args.airtableApiKey) {
    return args.airtableApiKey;
  }

  // 3. Environment variable (fallback)
  if (process.env.AIRTABLE_API_KEY) {
    return process.env.AIRTABLE_API_KEY;
  }

  // Provide detailed error based on what's missing
  const hasSession = !!context?.session;
  const hasHeaders = !!headers;
  throw new AuthenticationError(
    `Airtable API key required. ` +
    `Provide via: (1) airtableApiKey parameter, (2) x-airtable-api-key header, or (3) AIRTABLE_API_KEY env var. ` +
    `[Debug: session=${hasSession}, headers=${hasHeaders}]`
  );
}
