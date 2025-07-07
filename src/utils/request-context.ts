import { Request } from 'express';
import { config } from '../config/index.js';

export interface RequestContext {
  airtableApiKey?: string;
  airtableBaseId?: string;
}

/**
 * Extract context from HTTP request
 * Supports API key in multiple places:
 * 1. X-Airtable-Api-Key header
 * 2. Authorization header with Bearer token
 * 3. Request body (for MCP protocol)
 * 4. Environment variable as fallback
 */
export function extractRequestContext(req: Request): RequestContext {
  const context: RequestContext = {};
  
  // Check for API key in headers
  const apiKeyHeader = req.headers['x-airtable-api-key'] as string;
  const authHeader = req.headers['authorization'] as string;
  
  if (apiKeyHeader) {
    context.airtableApiKey = apiKeyHeader;
  } else if (authHeader && authHeader.startsWith('Bearer pat')) {
    // Airtable Personal Access Tokens start with 'pat'
    context.airtableApiKey = authHeader.replace('Bearer ', '');
  }
  
  // Check for API key in request body (MCP protocol)
  if (req.body?.params?.apiKey) {
    context.airtableApiKey = req.body.params.apiKey;
  }
  
  // Check for base ID in headers or body
  const baseIdHeader = req.headers['x-airtable-base-id'] as string;
  if (baseIdHeader) {
    context.airtableBaseId = baseIdHeader;
  } else if (req.body?.params?.baseId) {
    context.airtableBaseId = req.body.params.baseId;
  }
  
  // Fall back to environment variables if not provided
  if (!context.airtableApiKey && config.AIRTABLE_API_KEY) {
    context.airtableApiKey = config.AIRTABLE_API_KEY;
  }
  
  if (!context.airtableBaseId && config.AIRTABLE_BASE_ID) {
    context.airtableBaseId = config.AIRTABLE_BASE_ID;
  }
  
  return context;
}

/**
 * Validate that required context is present
 */
export function validateRequestContext(context: RequestContext, requireApiKey = true): void {
  if (requireApiKey && !context.airtableApiKey) {
    throw new Error(
      'Airtable API key is required. Provide it via:\n' +
      '- X-Airtable-Api-Key header\n' +
      '- Authorization: Bearer <token> header\n' +
      '- apiKey parameter in request\n' +
      '- AIRTABLE_API_KEY environment variable'
    );
  }
}