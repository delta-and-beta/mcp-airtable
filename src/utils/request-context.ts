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
  
  // Check for API key in various header formats
  const apiKeyHeader = req.headers['x-airtable-api-key'] as string;
  const authHeader = req.headers['authorization'] as string;
  
  if (apiKeyHeader) {
    context.airtableApiKey = apiKeyHeader;
  } else if (authHeader && authHeader.toLowerCase().startsWith('bearer pat')) {
    // Extract Airtable PAT from Authorization header
    context.airtableApiKey = authHeader.substring(7); // Remove "Bearer "
  }
  
  // Check for base ID in headers
  const baseIdHeader = req.headers['x-airtable-base-id'] as string;
  if (baseIdHeader) {
    context.airtableBaseId = baseIdHeader;
  }
  
  return context;
}