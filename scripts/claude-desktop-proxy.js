#!/usr/bin/env node

/**
 * Proxy script to connect Claude Desktop (stdio) to remote MCP SSE server
 * This allows Claude Desktop to communicate with Zeabur-deployed MCP servers
 */

const { spawn } = require('child_process');
const path = require('path');

// Get configuration from environment variables
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://your-app.zeabur.app/mcp';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';

// Validate required configuration
if (MCP_SERVER_URL.includes('your-app')) {
  console.error('Error: Please set MCP_SERVER_URL environment variable to your Zeabur deployment URL');
  process.exit(1);
}

// Path to the SSE client script
const sseClientPath = path.join(__dirname, '..', 'dist', 'sse-client.js');

// Spawn the SSE client with appropriate arguments
const sseClient = spawn('node', [
  sseClientPath,
  '--url', MCP_SERVER_URL,
  '--token', MCP_AUTH_TOKEN
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

// Handle process termination
sseClient.on('error', (err) => {
  console.error('Failed to start SSE client:', err);
  process.exit(1);
});

sseClient.on('exit', (code) => {
  process.exit(code || 0);
});

// Forward signals to child process
process.on('SIGINT', () => sseClient.kill('SIGINT'));
process.on('SIGTERM', () => sseClient.kill('SIGTERM'));