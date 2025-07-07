#!/usr/bin/env node

import { EventSource } from 'eventsource';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const SSE_URL = 'https://caissa-mcp-airtable.zeabur.app/mcp';
const AUTH_TOKEN = 'c74fcaec04bf90aa7bf2ad35c52d0f95289bf0889e3bfa00c9a79c09fe390f1a';

// First, let's test the connection directly
async function testDirectConnection() {
  console.log('Testing direct SSE connection...');
  
  const es = new EventSource(SSE_URL, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`
    }
  });

  return new Promise((resolve, reject) => {
    es.onopen = () => {
      console.log('✅ Direct SSE connection opened');
      es.close();
      resolve(true);
    };
    
    es.onerror = (error) => {
      console.log('❌ Direct SSE connection failed:', error);
      es.close();
      reject(error);
    };
    
    es.onmessage = (event) => {
      console.log('Message received:', event.data);
    };
    
    setTimeout(() => {
      es.close();
      reject(new Error('Connection timeout'));
    }, 5000);
  });
}

async function test() {
  // First test direct connection
  try {
    await testDirectConnection();
  } catch (error) {
    console.log('Direct connection test failed, continuing with SDK test...\n');
  }

  console.log('Connecting via MCP SDK to:', SSE_URL);
  
  // Create a custom EventSource constructor that includes auth headers
  const CustomEventSource = function(url, options) {
    return new EventSource(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...options?.headers
      }
    });
  };
  
  // Replace global EventSource with our custom one
  global.EventSource = CustomEventSource;
  
  const transport = new SSEClientTransport(
    new URL(SSE_URL),
    { 
      headers: { 
        'Authorization': `Bearer ${AUTH_TOKEN}` 
      } 
    }
  );

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected successfully!\n');
    
    // List tools
    console.log('📋 Listing available tools...');
    const tools = await client.listTools();
    console.log(`Found ${tools.tools.length} tools:\n`);
    
    tools.tools.forEach(tool => {
      console.log(`  • ${tool.name} - ${tool.description}`);
    });
    
    // Test list_bases
    console.log('\n🔍 Testing list_bases tool...');
    try {
      const result = await client.callTool('list_bases', {});
      const bases = JSON.parse(result.content[0].text);
      console.log('✅ Successfully retrieved bases:', bases);
    } catch (error) {
      console.log('❌ Error calling list_bases:', error.message);
    }
    
    await client.close();
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error details:', error);
  }
}

test();