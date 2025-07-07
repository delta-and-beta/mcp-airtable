#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'https://caissa-mcp-airtable.zeabur.app';
const TOKEN = 'c74fcaec04bf90aa7bf2ad35c52d0f95289bf0889e3bfa00c9a79c09fe390f1a';

async function testN8nFlow() {
  console.log('Testing n8n MCP flow...\n');

  // 1. Test initialize
  console.log('1. Testing initialize...');
  const initResponse = await fetch(`${BASE_URL}/mcp/n8n/${TOKEN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      id: 0,
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: '@n8n/n8n-nodes-langchain.mcpClientTool',
          version: '1'
        }
      }
    }),
  });

  const initResult = await initResponse.json();
  console.log('Initialize response:', JSON.stringify(initResult, null, 2));

  // 2. Test tools/list
  console.log('\n2. Testing tools/list...');
  const toolsResponse = await fetch(`${BASE_URL}/mcp/n8n/${TOKEN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1,
      params: {}
    }),
  });

  const toolsResult = await toolsResponse.json();
  console.log('Tools list response:', JSON.stringify(toolsResult, null, 2));

  // 3. Test a tool call
  if (toolsResult.result && toolsResult.result.tools && toolsResult.result.tools.length > 0) {
    const firstTool = toolsResult.result.tools[0];
    console.log(`\n3. Testing tool call: ${firstTool.name}...`);
    
    const callResponse = await fetch(`${BASE_URL}/mcp/n8n/${TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 2,
        params: {
          name: firstTool.name,
          arguments: {}
        }
      }),
    });

    const callResult = await callResponse.json();
    console.log('Tool call response:', JSON.stringify(callResult, null, 2));
  }
}

testN8nFlow().catch(console.error);