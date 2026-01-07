/**
 * Authentication utilities for API key extraction
 * Priority: headers > parameter > environment variable
 */

import { AuthenticationError } from "./errors.js";

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
