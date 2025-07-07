#!/usr/bin/env node

import { EventSource } from 'eventsource';

const URL = 'https://caissa-mcp-airtable.zeabur.app/mcp/n8n/c74fcaec04bf90aa7bf2ad35c52d0f95289bf0889e3bfa00c9a79c09fe390f1a';

console.log('Testing n8n MCP endpoint...\n');

const es = new EventSource(URL, {
  headers: {
    'Accept': 'text/event-stream'
  }
});

let messageCount = 0;

es.onopen = () => {
  console.log('✅ SSE Connection opened');
  
  // Send a test MCP request after connection
  setTimeout(() => {
    console.log('\nSending initialize request...');
    // Note: SSE is one-way, we can't send requests this way
    // This is just to show the connection is open
  }, 1000);
};

es.onmessage = (event) => {
  console.log('📨 Message received:');
  console.log('   Type:', event.type);
  console.log('   Data:', event.data);
  messageCount++;
  
  // Close after receiving a few messages
  if (messageCount > 5) {
    console.log('\nClosing connection...');
    es.close();
    process.exit(0);
  }
};

es.onerror = (error) => {
  console.log('❌ Error:', error);
  es.close();
  process.exit(1);
};

// Keep alive for 30 seconds max
setTimeout(() => {
  console.log('\nTimeout reached, closing...');
  es.close();
  process.exit(0);
}, 30000);