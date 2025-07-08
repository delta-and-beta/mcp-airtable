import { Request } from 'express';

export interface RequestContext {
  airtableApiKey?: string;
  airtableBaseId?: string;
  typecast?: boolean;
}

/**
 * Extract context from HTTP request headers
 */
export function extractRequestContext(req: Request): RequestContext {
  const context: RequestContext = {};
  
  // Convert all header keys to lowercase for case-insensitive lookup
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key.toLowerCase()] = value;
    }
  }
  
  // Check for API key in various header formats (case-insensitive)
  const apiKeyHeader = headers['x-airtable-api-key'];
  const authHeader = headers['authorization'];
  
  if (apiKeyHeader) {
    context.airtableApiKey = apiKeyHeader;
  } else if (authHeader && authHeader.toLowerCase().includes('pat')) {
    // Check if this is an Airtable PAT (not MCP auth token)
    const bearerToken = authHeader.replace(/^bearer\s+/i, '');
    if (bearerToken.startsWith('pat')) {
      context.airtableApiKey = bearerToken;
    }
  }
  
  // Check for base ID in headers (case-insensitive)
  const baseIdHeader = headers['x-airtable-base-id'];
  if (baseIdHeader) {
    context.airtableBaseId = baseIdHeader;
  }
  
  // Check for typecast option in headers (case-insensitive)
  const typecastHeader = headers['x-airtable-option-typecast'];
  if (typecastHeader !== undefined) {
    // Accept various boolean representations
    const value = typecastHeader.toLowerCase();
    context.typecast = value === 'true' || value === '1' || value === 'yes';
  }
  
  return context;
}