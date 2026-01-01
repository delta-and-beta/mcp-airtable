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
import { logger } from './utils/logger.js';
import { formatErrorResponse, AuthenticationError } from './utils/errors.js';
import { toolHandlers, toolDefinitions } from './tools/index.js';
import { prepareResponse } from './utils/response-sanitizer.js';
import { extractRequestContext } from './utils/request-context.js';

// Load environment variables
loadEnv();
validateConfig();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', async (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-airtable',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    transport: 'http-streamable',
  });
});

// Authentication middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

  // Check query parameter
  const queryToken = req.query.token as string;
  if (queryToken === config.MCP_AUTH_TOKEN) {
    next();
    return;
  }

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

// HTTP Streamable endpoint for n8n
app.post('/stream', authenticate, async (req, res) => {
  const message = req.body;
  
  logger.debug('HTTP Streamable request', { 
    method: message?.method,
    id: message?.id,
  });

  try {
    // Handle different message types
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
        },
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

// n8n-specific streamable endpoint with token in path
app.post('/stream/n8n/:token', async (req, res) => {
  const { token } = req.params;
  
  // Validate token
  if (config.MCP_AUTH_TOKEN && token !== config.MCP_AUTH_TOKEN) {
    logger.warn('Invalid token in n8n streamable endpoint', { ip: req.ip });
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

// Start server
const PORT = parseInt(config.PORT || '3000', 10);
app.listen(PORT, () => {
  logger.info('MCP Airtable HTTP Streamable server started', {
    port: PORT,
    environment: config.NODE_ENV,
    authEnabled: !!config.MCP_AUTH_TOKEN,
    endpoints: ['/stream', '/stream/n8n/:token'],
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