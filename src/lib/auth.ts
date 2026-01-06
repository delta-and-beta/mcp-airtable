/**
 * Authentication utilities for API key extraction
 * Supports: parameter > headers > environment variable
 */

export function extractApiKey(
  args: { airtableApiKey?: string },
  context?: any
): string {
  // 1. Tool parameter (highest priority)
  if (args.airtableApiKey) {
    return args.airtableApiKey;
  }

  // 2. HTTP headers (from Claude Desktop via mcp-remote)
  if (context?.request?.headers) {
    const headers = context.request.headers;

    // Try x-airtable-api-key (case-insensitive)
    const apiKeyHeader = 
      headers["x-airtable-api-key"] ||
      headers["X-Airtable-Api-Key"] ||
      headers["X-AIRTABLE-API-KEY"];

    if (apiKeyHeader) {
      return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    }

    // Try Authorization: Bearer pat...
    const auth = headers["authorization"] || headers["Authorization"];
    if (auth) {
      const authStr = Array.isArray(auth) ? auth[0] : auth;
      if (authStr.startsWith("Bearer pat")) {
        return authStr.substring(7);
      }
    }
  }

  // 3. Environment variable (fallback)
  if (process.env.AIRTABLE_API_KEY) {
    return process.env.AIRTABLE_API_KEY;
  }

  throw new Error(
    "Airtable API key required. Provide via airtableApiKey parameter, " +
    "x-airtable-api-key header, or AIRTABLE_API_KEY environment variable."
  );
}
