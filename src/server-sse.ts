#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { toolHandlers, toolDefinitions } from './handlers/tools.js';

config();

const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mcp-airtable' });
});

// Authentication middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!AUTH_TOKEN) {
    // If no auth token is configured, allow all requests (for development)
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.substring(7);
  if (token !== AUTH_TOKEN) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  next();
};

// MCP SSE endpoint
app.get('/mcp', authenticate, async (req, res) => {
  console.log('New MCP SSE connection');
  
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
    
    const handler = toolHandlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    try {
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
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  await server.connect(transport);
  
  // Keep the connection alive
  req.on('close', () => {
    console.log('MCP SSE connection closed');
    server.close();
  });
});

app.listen(PORT, () => {
  console.log(`MCP Airtable server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  if (AUTH_TOKEN) {
    console.log('Authentication enabled');
  } else {
    console.log('WARNING: Authentication disabled - set MCP_AUTH_TOKEN environment variable');
  }
});