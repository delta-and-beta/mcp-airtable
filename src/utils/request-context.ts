import { Request } from 'express';

export interface RequestContext {
  airtableApiKey?: string;
  airtableBaseId?: string;
  typecast?: boolean;
  maxRecords?: number;
  authMode?: 'apikey' | 'oauth';
  oauthAccessToken?: string;
  userId?: string;
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
  const oauthTokenHeader = headers['x-airtable-oauth-token'];
  const userIdHeader = headers['x-airtable-user-id'];
  
  // Check for OAuth token first
  if (oauthTokenHeader) {
    context.oauthAccessToken = oauthTokenHeader;
    context.authMode = 'oauth';
    if (userIdHeader) {
      context.userId = userIdHeader;
    }
  } else if (apiKeyHeader) {
    context.airtableApiKey = apiKeyHeader;
    context.authMode = 'apikey';
  } else if (authHeader && authHeader.toLowerCase().includes('pat')) {
    // Check if this is an Airtable PAT (not MCP auth token)
    const bearerToken = authHeader.replace(/^bearer\s+/i, '');
    if (bearerToken.startsWith('pat')) {
      context.airtableApiKey = bearerToken;
      context.authMode = 'apikey';
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
  
  // Check for max records option in headers (case-insensitive)
  const maxRecordsHeader = headers['x-airtable-option-max-records'];
  if (maxRecordsHeader !== undefined) {
    const value = parseInt(maxRecordsHeader);
    if (!isNaN(value) && value > 0) {
      context.maxRecords = value;
    }
  }
  
  return context;
}