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
import { rateLimitMiddleware } from './utils/rate-limiter-redis.js';
import { extractRequestContext } from './utils/request-context.js';

// Load environment variables
// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
  loadEnv();
}
validateConfig();

const app = express();

// Security headers middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like Postman or server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    // In production, use strict CORS
    if (config.NODE_ENV === 'production') {
      const allowedOrigins = config.CORS_ORIGIN?.split(',').map(o => o.trim()) || [];
      if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
        // If no specific origins configured, deny all in production
        return callback(new Error('CORS not configured for production'));
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
    
    // In development, allow all
    callback(null, true);
  },
  credentials: true,
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
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
  // In production, authentication is mandatory
  if (config.NODE_ENV === 'production' && !config.MCP_AUTH_TOKEN) {
    logger.error('MCP_AUTH_TOKEN must be set in production');
    res.status(500).json(formatErrorResponse(new Error('Server configuration error')));
    return;
  }

  // Skip authentication in development if no token is set
  if (!config.MCP_AUTH_TOKEN) {
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
    path: req.path,
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
app.post('/mcp', authenticate, rateLimitMiddleware(), async (req, res) => {
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
          // Extract context from request headers
          const context = extractRequestContext(req);
          
          // Merge context with args (args take precedence)
          const argsWithContext = {
            ...context,
            ...args,
          };
          
          const result = await handler(argsWithContext);
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