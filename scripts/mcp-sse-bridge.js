#!/usr/bin/env node

/**
 * MCP SSE Bridge for Claude Desktop
 * This script bridges Claude Desktop's stdio transport to a remote SSE server
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Get configuration from environment or command line
const SSE_URL = process.argv[2] || process.env.MCP_SSE_URL;
const AUTH_TOKEN = process.env.MCP_SSE_AUTH_TOKEN || process.env.MCP_AUTH_TOKEN;

if (!SSE_URL) {
  console.error('Error: SSE URL is required');
  console.error('Usage: mcp-sse-bridge.js <SSE_URL>');
  console.error('Or set MCP_SSE_URL environment variable');
  process.exit(1);
}

// Create SSE client transport
const headers = {};
if (AUTH_TOKEN) {
  headers['Authorization'] = AUTH_TOKEN.startsWith('Bearer ') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`;
}

const sseTransport = new SSEClientTransport(new URL(SSE_URL), { headers });

// Create stdio server transport for Claude Desktop
const stdioTransport = new StdioServerTransport();

// Create client to connect to SSE server
const client = new Client(
  { name: 'claude-desktop-bridge', version: '1.0.0' },
  { capabilities: {} }
);

// Create server to handle Claude Desktop requests
const server = new Server(
  { name: 'mcp-sse-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Bridge the connections
async function bridge() {
  try {
    // Connect to SSE server
    await client.connect(sseTransport);
    console.error(`Connected to SSE server: ${SSE_URL}`);
    
    // Set up request handlers to forward from Claude Desktop to SSE server
    server.setRequestHandler('initialize', async (request) => {
      return { protocolVersion: '2024-11-05', capabilities: { tools: {} } };
    });
    
    server.setRequestHandler('tools/list', async () => {
      const result = await client.listTools();
      return result;
    });
    
    server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      const result = await client.callTool(name, args);
      return result;
    });
    
    // Connect to Claude Desktop
    await server.connect(stdioTransport);
    console.error('Bridge ready for Claude Desktop');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      await client.close();
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Bridge error:', error);
    process.exit(1);
  }
}

bridge();