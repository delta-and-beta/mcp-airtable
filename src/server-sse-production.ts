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

// Version endpoint to check deployment
app.get('/version', (_req, res) => {
  res.json({
    version: '1.0.2',
    features: ['query-auth', 'n8n-endpoint', 'http-streamable'],
    endpoints: {
      sse: ['/mcp', '/mcp/n8n/:token'],
      streamable: ['/stream', '/stream/n8n/:token']
    },
    lastUpdated: '2025-01-07'
  });
});

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

// Authentication middleware with query parameter fallback
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!config.MCP_AUTH_TOKEN) {
    if (config.NODE_ENV === 'production') {
      logger.warn('Authentication token not configured in production');
    }
    next();
    return;
  }

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === config.MCP_AUTH_TOKEN) {
      next();
      return;
    }
  }

  // Fallback to query parameter for SSE clients that don't support headers
  const queryToken = req.query.token as string;
  if (queryToken === config.MCP_AUTH_TOKEN) {
    logger.debug('Authenticated via query parameter', { ip: req.ip });
    next();
    return;
  }

  // Check X-Auth-Token header as another fallback
  const xAuthToken = req.headers['x-auth-token'] as string;
  if (xAuthToken === config.MCP_AUTH_TOKEN) {
    logger.debug('Authenticated via X-Auth-Token header', { ip: req.ip });
    next();
    return;
  }

  logger.warn('Authentication failed', { 
    ip: req.ip,
    hasAuthHeader: !!authHeader,
    hasQueryToken: !!queryToken,
    hasXAuthToken: !!xAuthToken
  });
  res.status(401).json(formatErrorResponse(new AuthenticationError('Invalid or missing authentication')));
};

// MCP SSE endpoint
app.get('/mcp', authenticate, async (req, res) => {
  const connectionId = crypto.randomBytes(16).toString('hex');
  logger.info('New MCP SSE connection', { connectionId, ip: req.ip });
  
  try {
    // Create transport with custom options
    const transport = new SSEServerTransport('/mcp', res);
    
    // Override the start method to add our custom headers
    const originalStart = transport.start.bind(transport);
    transport.start = async () => {
      // Add custom headers to disable buffering and compression
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
      res.setHeader('Content-Encoding', 'identity'); // Disable compression
      res.removeHeader('Content-Length'); // Remove content length for streaming
      await originalStart();
      // Send initial comment after headers are set
      res.write(':ok\n\n');
    };
    
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
    
    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(':heartbeat\n\n');
      } catch (error) {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
    
    // Handle connection cleanup
    req.on('close', () => {
      logger.info('MCP SSE connection closed', { connectionId });
      clearInterval(heartbeatInterval);
      server.close().catch(err => {
        logger.error('Error closing server', err);
      });
    });
  } catch (error) {
    logger.error('Failed to establish MCP connection', error as Error, { connectionId });
    res.status(500).json(formatErrorResponse(error as Error));
  }
});

// Store active n8n SSE connections
const n8nConnections = new Map<string, any>();

// n8n-specific POST endpoint for handling requests
app.post('/mcp/n8n/:token', express.json(), async (req, res) => {
  const { token } = req.params;
  
  // Validate token
  if (config.MCP_AUTH_TOKEN && token !== config.MCP_AUTH_TOKEN) {
    logger.warn('Invalid token in n8n POST endpoint', { ip: req.ip });
    res.status(401).json(formatErrorResponse(new AuthenticationError('Invalid token')));
    return;
  }
  
  const message = req.body;
  logger.debug('n8n POST request', { 
    method: message?.method,
    id: message?.id,
    params: message?.params 
  });
  
  // Handle MCP protocol messages
  try {
    
    // Get the server instance for this connection (if exists)
    const connectionKey = `${req.ip}-${token}`;
    const server = n8nConnections.get(connectionKey);
    
    if (!server) {
      // Create a temporary server instance for request handling
      const tempServer = new Server(
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

      tempServer.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: toolDefinitions,
        };
      });

      tempServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        
        const handler = toolHandlers[name as keyof typeof toolHandlers];
        if (!handler) {
          throw new Error(`Unknown tool: ${name}`);
        }
        
        const result = await handler(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      });
      
      // Handle different message types
      if (message.method === 'initialize') {
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-03-26', // Match n8n's protocol version
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
      } else if (message.method === 'tools/list') {
        logger.debug('n8n requesting tools list');
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: toolDefinitions.map(tool => ({
              ...tool,
              name: tool.name,
              description: tool.description || '',
              inputSchema: tool.inputSchema || { type: 'object', properties: {} }
            })),
          }
        });
      } else if (message.method === 'tools/call') {
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
          res.json({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
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
      } else {
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`,
          }
        });
      }
    } else {
      // For existing connections, just return success
      res.json({
        jsonrpc: '2.0',
        id: message.id,
        result: {}
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('n8n POST request error', error instanceof Error ? error : new Error(errorMessage));
    res.status(500).json({
      error: {
        code: -32603,
        message: errorMessage,
      }
    });
  }
});

// n8n-specific GET endpoint for SSE connection
app.get('/mcp/n8n/:token', async (req, res) => {
  const { token } = req.params;
  
  // Validate token
  if (config.MCP_AUTH_TOKEN && token !== config.MCP_AUTH_TOKEN) {
    logger.warn('Invalid token in n8n endpoint', { ip: req.ip });
    res.status(401).json(formatErrorResponse(new AuthenticationError('Invalid token')));
    return;
  }
  
  const connectionId = crypto.randomBytes(16).toString('hex');
  logger.info('New n8n MCP SSE connection', { connectionId, ip: req.ip });
  
  try {
    // Create transport with custom options
    const transport = new SSEServerTransport('/mcp/n8n/' + token, res);
    
    // Override the start method to add our custom headers
    const originalStart = transport.start.bind(transport);
    transport.start = async () => {
      // Add custom headers to disable buffering and compression
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
      res.setHeader('Content-Encoding', 'identity'); // Disable compression
      res.removeHeader('Content-Length'); // Remove content length for streaming
      await originalStart();
      // Send initial comment after headers are set
      res.write(':ok\n\n');
    };
    
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
        logger.debug('Executing tool from n8n', { tool: name, connectionId });
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
    
    // Store the server instance for POST requests
    const connectionKey = `${req.ip}-${token}`;
    n8nConnections.set(connectionKey, server);
    
    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(':heartbeat\n\n');
      } catch (error) {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
    
    // Handle connection cleanup
    req.on('close', () => {
      logger.info('n8n MCP SSE connection closed', { connectionId });
      clearInterval(heartbeatInterval);
      n8nConnections.delete(connectionKey);
      server.close().catch(err => {
        logger.error('Error closing server', err);
      });
    });
  } catch (error) {
    logger.error('Failed to establish n8n MCP connection', error as Error, { connectionId });
    res.status(500).json(formatErrorResponse(error as Error));
  }
});

// HTTP Streamable endpoint (for n8n compatibility)
app.post('/stream', authenticate, async (req, res) => {
  const message = req.body;
  
  logger.debug('HTTP Streamable request', { 
    method: message?.method,
    id: message?.id,
  });

  try {
    if (message.method === 'initialize') {
      res.json({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-03-26',
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
    } else if (message.method === 'tools/list') {
      res.json({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: toolDefinitions,
        }
      });
    } else if (message.method === 'tools/call') {
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
        res.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
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
    } else {
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
    logger.error('HTTP Streamable request error', error instanceof Error ? error : new Error(errorMessage));
    res.json({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32603,
        message: errorMessage,
      }
    });
  }
});

// HTTP Streamable endpoint with token in path for n8n
app.post('/stream/n8n/:token', async (req, res) => {
  const { token } = req.params;
  
  if (config.MCP_AUTH_TOKEN && token !== config.MCP_AUTH_TOKEN) {
    res.status(401).json(formatErrorResponse(new AuthenticationError('Invalid token')));
    return;
  }
  
  // Forward to main stream handler with authentication
  const message = req.body;
  
  logger.debug('HTTP Streamable request via n8n endpoint', { 
    method: message?.method,
    id: message?.id,
  });
  
  // Reuse the stream endpoint logic
  req.headers.authorization = `Bearer ${token}`;
  const streamHandler = app._router.stack.find((layer: any) => 
    layer.route?.path === '/stream' && layer.route?.methods?.post
  );
  
  if (streamHandler && streamHandler.route.stack[1]) {
    streamHandler.route.stack[1].handle(req, res);
  } else {
    res.status(500).json({ error: 'Stream handler not found' });
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