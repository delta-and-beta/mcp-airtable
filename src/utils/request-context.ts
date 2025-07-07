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
  } else if (authHeader && authHeader.toLowerCase().startsWith('bearer pat')) {
    // Extract Airtable PAT from Authorization header
    context.airtableApiKey = authHeader.substring(7); // Remove "Bearer "
  }
  
  // Check for base ID in headers (case-insensitive)
  const baseIdHeader = headers['x-airtable-base-id'];
  if (baseIdHeader) {
    context.airtableBaseId = baseIdHeader;
  }
  
  return context;
}