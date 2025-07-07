#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config as loadEnv } from 'dotenv';
import { validateConfig, config } from './config/index.js';
import { logger, requestLogger } from './utils/logger.js';
import { formatErrorResponse, AuthenticationError } from './utils/errors.js';
import { toolHandlers, toolDefinitions } from './tools/index.js';
import { prepareResponse } from './utils/response-sanitizer.js';

// Load environment variables
// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
  loadEnv();
}
validateConfig();

const app = express();

// Middleware
app.use(cors({
  origin: config.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (_req, res) => {
  const health = {
    status: 'ok',
    service: 'mcp-airtable',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    transport: 'http',
    checks: {
      airtable: { status: 'ok' as const },
      storage: { 
        s3: config.AWS_S3_BUCKET ? 'configured' as const : 'not_configured' as const,
        gcs: config.GCS_BUCKET ? 'configured' as const : 'not_configured' as const,
      },
    },
  };
  res.json(health);
});

// Authentication middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!config.MCP_AUTH_TOKEN) {
    if (config.NODE_ENV === 'production') {
      logger.warn('Authentication token not configured in production');
    }
    next();
    return;
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === config.MCP_AUTH_TOKEN) {
      next();
      return;
    }
  }

  // Check X-MCP-Token header as fallback
  const mcpToken = req.headers['x-mcp-token'] as string;
  if (mcpToken === config.MCP_AUTH_TOKEN) {
    next();
    return;
  }

  logger.warn('Authentication failed', { 
    ip: req.ip,
    hasAuthHeader: !!authHeader,
    hasMcpToken: !!mcpToken,
  });
  res.status(401).json(formatErrorResponse(new AuthenticationError('Invalid or missing authentication')));
};

// Create MCP server instance
const mcpServer = new Server(
  {
    name: 'mcp-airtable',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Set up request handlers
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolDefinitions,
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const handler = toolHandlers[name as keyof typeof toolHandlers];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  
  try {
    logger.debug('Executing tool', { tool: name });
    const result = await handler(args);
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

// MCP Protocol endpoint
app.post('/mcp', authenticate, async (req, res) => {
  const message = req.body;
  
  logger.debug('MCP request', { 
    method: message?.method,
    id: message?.id,
  });

  try {
    // Handle different MCP protocol methods
    switch (message.method) {
      case 'initialize':
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {}
            },
            serverInfo: {
              name: 'mcp-airtable',
              version: '1.0.0',
            }
          }
        });
        break;

      case 'tools/list':
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: toolDefinitions,
          },
        });
        break;

      case 'tools/call':
        const { name, arguments: args } = message.params;
        const handler = toolHandlers[name as keyof typeof toolHandlers];
        
        if (!handler) {
          res.json({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`,
            }
          });
          return;
        }
        
        try {
          const result = await handler(args);
          const sanitizedResult = prepareResponse(result);
          res.json({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(sanitizedResult, null, 2),
                },
              ],
            }
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          res.json({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32603,
              message: errorMessage,
            }
          });
        }
        break;

      case 'resources/list':
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            resources: [],
          },
        });
        break;

      case 'prompts/list':
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            prompts: [],
          },
        });
        break;

      default:
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`,
          }
        });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('MCP request error', error instanceof Error ? error : new Error(errorMessage));
    res.status(500).json({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32603,
        message: errorMessage,
      }
    });
  }
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json(formatErrorResponse(err));
});

// Graceful shutdown
let server: any;

async function shutdown() {
  logger.info('Shutting down gracefully...');
  
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
  }
  
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const PORT = parseInt(config.PORT, 10);
server = app.listen(PORT, () => {
  logger.info('MCP Airtable HTTP server started', {
    port: PORT,
    environment: config.NODE_ENV,
    authEnabled: !!config.MCP_AUTH_TOKEN,
    storageEnabled: {
      s3: !!config.AWS_S3_BUCKET,
      gcs: !!config.GCS_BUCKET,
    },
  });
});

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', reason as Error, { promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});