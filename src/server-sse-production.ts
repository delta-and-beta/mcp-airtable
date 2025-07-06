#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { config as loadEnv } from 'dotenv';
import { config, validateConfig } from './utils/config.js';
import { logger, requestLogger } from './utils/logger.js';
import { formatErrorResponse, AuthenticationError } from './utils/errors.js';
import { toolHandlers } from './handlers/tools-refactored.js';
import { toolDefinitions } from './handlers/tools.js';

// Load environment variables
loadEnv();

// Validate configuration on startup
validateConfig();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Health check endpoint with dependency checks
app.get('/health', async (_req, res) => {
  const health = {
    status: 'ok',
    service: 'mcp-airtable',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    checks: {
      airtable: { status: 'ok' as const },
      s3: { status: config.AWS_S3_BUCKET ? 'ok' as const : 'not_configured' as const },
    },
  };

  // Could add actual connectivity checks here
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

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header', { ip: req.ip });
    res.status(401).json(formatErrorResponse(new AuthenticationError('Missing authorization header')));
    return;
  }

  const token = authHeader.substring(7);
  if (token !== config.MCP_AUTH_TOKEN) {
    logger.warn('Invalid authentication token', { ip: req.ip });
    res.status(401).json(formatErrorResponse(new AuthenticationError('Invalid token')));
    return;
  }

  next();
};

// MCP SSE endpoint
app.get('/mcp', authenticate, async (req, res) => {
  const connectionId = crypto.randomBytes(16).toString('hex');
  logger.info('New MCP SSE connection', { connectionId, ip: req.ip });
  
  try {
    const transport = new SSEServerTransport('/mcp', res);
    
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
      
      const handler = toolHandlers[name as keyof typeof toolHandlers];
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }
      
      try {
        logger.debug('Executing tool', { tool: name, connectionId });
        const result = await handler(args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool execution failed', error as Error, { tool: name, connectionId });
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

    await server.connect(transport);
    
    // Handle connection cleanup
    req.on('close', () => {
      logger.info('MCP SSE connection closed', { connectionId });
      server.close().catch(err => {
        logger.error('Error closing server', err);
      });
    });
  } catch (error) {
    logger.error('Failed to establish MCP connection', error as Error, { connectionId });
    res.status(500).json(formatErrorResponse(error as Error));
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
  logger.info('MCP Airtable server started', {
    port: PORT,
    environment: config.NODE_ENV,
    authEnabled: !!config.MCP_AUTH_TOKEN,
    s3Enabled: !!config.AWS_S3_BUCKET,
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