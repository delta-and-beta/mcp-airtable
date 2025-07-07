import { Request } from 'express';

export interface RequestContext {
  airtableApiKey?: string;
  airtableBaseId?: string;
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
  
  // Debug logging - log all headers
  console.log('[DEBUG] All request headers:', Object.keys(headers));
  
  // Debug logging
  if (headers['x-airtable-api-key'] || headers['authorization']) {
    console.log('[DEBUG] Found auth headers:', {
      'x-airtable-api-key': headers['x-airtable-api-key'] ? 'present' : 'missing',
      'authorization': headers['authorization'] ? headers['authorization'].substring(0, 20) + '...' : 'missing'
    });
  }
  
  // Check for API key in various header formats (case-insensitive)
  const apiKeyHeader = headers['x-airtable-api-key'];
  const authHeader = headers['authorization'];
  
  if (apiKeyHeader) {
    context.airtableApiKey = apiKeyHeader;
    console.log('[DEBUG] Found Airtable API key in x-airtable-api-key header');
  } else if (authHeader && authHeader.toLowerCase().includes('pat')) {
    // Check if this is an Airtable PAT (not MCP auth token)
    const bearerToken = authHeader.replace(/^bearer\s+/i, '');
    if (bearerToken.startsWith('pat')) {
      context.airtableApiKey = bearerToken;
      console.log('[DEBUG] Found Airtable PAT in Authorization header');
    }
  }
  
  // Check for base ID in headers (case-insensitive)
  const baseIdHeader = headers['x-airtable-base-id'];
  if (baseIdHeader) {
    context.airtableBaseId = baseIdHeader;
  }
  
  return context;
}