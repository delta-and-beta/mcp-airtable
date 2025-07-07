#!/usr/bin/env node

/**
 * MCP SSE Bridge for Claude Desktop using fetch API
 * Works around EventSource authentication issues
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const SSE_URL = process.env.MCP_SSE_URL || 'https://caissa-mcp-airtable.zeabur.app/mcp';
const AUTH_TOKEN = process.env.MCP_SSE_AUTH_TOKEN || process.env.MCP_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('Error: MCP_AUTH_TOKEN is required');
  process.exit(1);
}

// Custom EventSource that uses fetch
class FetchEventSource {
  constructor(url, options) {
    this.url = url;
    this.headers = options?.headers || {};
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this._controller = new AbortController();
    this._connect();
  }

  async _connect() {
    try {
      const response = await fetch(this.url, {
        headers: {
          'Accept': 'text/event-stream',
          ...this.headers
        },
        signal: this._controller.signal
      });

      if (!response.ok) {
        this.readyState = 2; // CLOSED
        if (this.onerror) {
          this.onerror({
            type: 'error',
            message: `Non-200 status code (${response.status})`,
            code: response.status
          });
        }
        return;
      }

      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const event = line.slice(6).trim();
            // Handle event type
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (this.onmessage) {
              this.onmessage({
                type: 'message',
                data: data,
                lastEventId: '',
                origin: this.url
              });
            }
          }
        }
      }
    } catch (error) {
      this.readyState = 2; // CLOSED
      if (this.onerror && !this._controller.signal.aborted) {
        this.onerror(error);
      }
    }
  }

  close() {
    this._controller.abort();
    this.readyState = 2; // CLOSED
    if (this.onclose) {
      this.onclose();
    }
  }
}

// Replace global EventSource with our custom implementation
global.EventSource = FetchEventSource;

async function main() {
  console.error(`Starting MCP SSE Bridge`);
  console.error(`Connecting to: ${SSE_URL}`);

  try {
    // Create stdio server for Claude Desktop
    const server = new Server(
      {
        name: 'mcp-airtable-bridge',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Create SSE client with auth
    const headers = {
      'Authorization': AUTH_TOKEN.startsWith('Bearer ') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`
    };

    const sseTransport = new SSEClientTransport(new URL(SSE_URL), { headers });
    const client = new Client(
      { name: 'bridge-client', version: '1.0.0' },
      { capabilities: {} }
    );

    // Connect to remote SSE server
    await client.connect(sseTransport);
    console.error('Connected to SSE server');

    // Set up request forwarding
    server.setRequestHandler('initialize', async (request) => {
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'mcp-airtable-bridge',
          version: '1.0.0'
        }
      };
    });

    server.setRequestHandler('tools/list', async (request) => {
      return await client.listTools();
    });

    server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      return await client.callTool(name, args);
    });

    // Connect to Claude Desktop via stdio
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('Bridge ready for Claude Desktop');

    // Handle shutdown
    process.on('SIGINT', async () => {
      await client.close();
      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await client.close();
      await server.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Bridge error:', error);
    process.exit(1);
  }
}

main();