#!/usr/bin/env node

/**
 * WebSocket Proxy for MCP SSE Server
 * This proxy converts WebSocket connections to SSE connections
 * Useful for tools like n8n that have trouble with SSE authentication
 */

import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';
import { createServer } from 'http';

const SSE_URL = process.env.SSE_URL || 'https://caissa-mcp-airtable.zeabur.app/mcp';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'c74fcaec04bf90aa7bf2ad35c52d0f95289bf0889e3bfa00c9a79c09fe390f1a';
const PORT = process.env.PORT || 8080;

console.log('Starting WebSocket proxy server...');
console.log(`SSE URL: ${SSE_URL}`);
console.log(`Listening on port: ${PORT}`);

// Create HTTP server
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mcp-websocket-proxy' }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  let sseController = new AbortController();
  let isConnected = true;
  
  // Connect to SSE server
  const connectSSE = async () => {
    try {
      const response = await fetch(SSE_URL, {
        headers: {
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        signal: sseController.signal
      });
      
      if (!response.ok) {
        console.error(`SSE connection failed: ${response.status}`);
        ws.send(JSON.stringify({
          error: `SSE connection failed: ${response.status}`
        }));
        ws.close();
        return;
      }
      
      console.log('Connected to SSE server');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (isConnected) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        let currentEvent = { event: 'message', data: '' };
        
        for (const line of lines) {
          if (line.trim() === '') {
            // Empty line signals end of event
            if (currentEvent.data) {
              ws.send(JSON.stringify(currentEvent));
              currentEvent = { event: 'message', data: '' };
            }
          } else if (line.startsWith('event:')) {
            currentEvent.event = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentEvent.data = line.slice(5).trim();
          }
        }
      }
    } catch (error) {
      if (!sseController.signal.aborted) {
        console.error('SSE error:', error);
        ws.send(JSON.stringify({
          error: error.message
        }));
      }
    }
  };
  
  connectSSE();
  
  // Handle incoming WebSocket messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received WebSocket message:', data);
      
      // Forward to SSE server via POST
      const response = await fetch(SSE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      ws.send(JSON.stringify(result));
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        error: error.message
      }));
    }
  });
  
  // Handle WebSocket close
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    isConnected = false;
    sseController.abort();
  });
  
  // Handle WebSocket error
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket proxy server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});