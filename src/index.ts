#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config as loadEnv } from 'dotenv';
import { validateConfig } from './utils/config.js';
import { logger } from './utils/logger.js';
import { formatErrorResponse } from './utils/errors.js';
import { toolHandlers, toolDefinitions } from './handlers/tools.js';
import { prepareResponse } from './utils/response-sanitizer.js';

// Load environment variables
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Try to load .env from project root
loadEnv({ path: join(projectRoot, '.env') });

// Also try current directory as fallback
if (!process.env.AIRTABLE_API_KEY) {
  loadEnv();
}

validateConfig();

const server = new Server(
  {
    name: 'mcp-airtable',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolDefinitions,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Log the incoming request (sanitize sensitive data)
  logger.debug('Received tool request', { 
    tool: name,
    hasArgs: !!args,
    argsKeys: args ? Object.keys(args) : []
  });
  
  const handler = toolHandlers[name as keyof typeof toolHandlers];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  
  try {
    logger.debug('Executing tool', { tool: name });
    const result = await handler(args);
    
    // Sanitize and prepare the response
    const sanitizedResult = prepareResponse(result);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sanitizedResult, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error('Tool execution failed', error as Error, { tool: name });
    const errorResponse = formatErrorResponse(error as Error);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP Airtable server running on stdio');
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});