#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config as loadEnv } from 'dotenv';
import { validateConfig, config } from './config/index.js';
import { logger, requestLogger } from './utils/logger.js';
import { formatErrorResponse } from './utils/errors.js';
import { toolHandlers, toolDefinitions } from './tools/index.js';
import { prepareResponse } from './utils/response-sanitizer.js';
import { rateLimitMiddleware } from './utils/rate-limiter-redis.js';
import oauthRoutes from './routes/oauth.js';

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

// CORS configuration - allow all origins for MCP protocol
const corsOptions: cors.CorsOptions = {
  origin: true,
  credentials: true,
  maxAge: 86400, // 24 hours
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-MCP-Token', 'x-airtable-api-key', 'x-airtable-option-typecast', 'Mcp-Session-Id'],
  exposedHeaders: ['Mcp-Session-Id'],
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
    transport: 'streamable-http',
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

// OAuth routes (no authentication required for OAuth flow)
if (config.AIRTABLE_OAUTH_ENABLED) {
  app.use('/oauth', oauthRoutes);
}

// Map to store transports by session ID for stateful connections
const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Create MCP server instance with tool handlers
 */
function createMCPServer(): Server {
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

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlers[name as keyof typeof toolHandlers];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      logger.debug('Executing tool', { tool: name });

      // Extract context from transport's request context if available
      // The transport passes request info through extra.requestInfo
      let context: Record<string, unknown> = {};
      if (extra?.requestInfo) {
        // Try to get headers from the original request
        const requestInfo = extra.requestInfo as { headers?: Record<string, string | string[] | undefined> };
        if (requestInfo.headers) {
          context = {
            airtableApiKey: requestInfo.headers['x-airtable-api-key'],
            typecast: requestInfo.headers['x-airtable-option-typecast'] === 'true',
          };
        }
      }

      // Merge context with args (args take precedence)
      const argsWithContext = {
        ...context,
        ...args,
      };

      const result = await handler(argsWithContext);
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

  return mcpServer;
}

// MCP Protocol endpoint - Streamable HTTP transport
app.all('/mcp', rateLimitMiddleware(), async (req, res) => {
  logger.debug('MCP request', {
    method: req.method,
    sessionId: req.headers['mcp-session-id'],
    contentType: req.headers['content-type'],
  });

  try {
    // Check for existing session
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport for session
      transport = transports.get(sessionId)!;
    } else if (req.method === 'POST' && !sessionId) {
      // New session - create transport and server
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const mcpServer = createMCPServer();

      // Clean up on close
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          transports.delete(sid);
          logger.debug('Session closed', { sessionId: sid });
        }
      };

      // Connect server to transport
      await mcpServer.connect(transport);

      // Store transport by session ID after it's generated
      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
        logger.debug('New session created', { sessionId: transport.sessionId });
      }
    } else if (req.method === 'GET') {
      // SSE stream for server-initiated messages (stateless)
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      const mcpServer = createMCPServer();
      await mcpServer.connect(transport);
    } else {
      // Invalid request - session required but not found
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Bad Request: Session ID required for non-initialization requests',
        },
        id: null,
      });
      return;
    }

    // Handle the request with the transport
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error('MCP request error', error instanceof Error ? error : new Error('Unknown error'));
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Handle DELETE for session termination
app.delete('/mcp', (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    transport.close();
    transports.delete(sessionId);
    res.status(204).send();
    logger.debug('Session terminated via DELETE', { sessionId });
  } else {
    res.status(404).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Session not found',
      },
      id: null,
    });
  }
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json(formatErrorResponse(err));
});

// Graceful shutdown
// eslint-disable-next-line prefer-const, @typescript-eslint/no-explicit-any
let server: any;

async function shutdown() {
  logger.info('Shutting down gracefully...');

  // Close all active transports
  for (const [sessionId, transport] of transports) {
    logger.debug('Closing transport', { sessionId });
    await transport.close();
  }
  transports.clear();

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
    transport: 'streamable-http',
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
