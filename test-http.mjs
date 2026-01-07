#!/usr/bin/env node
/**
 * Test MCP HTTP Endpoint
 */

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.AIRTABLE_API_KEY || '';

async function mcpRequest(method, params = {}, sessionId = null, apiKey = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  if (sessionId) headers['mcp-session-id'] = sessionId;
  if (apiKey) headers['x-airtable-api-key'] = apiKey;

  const response = await fetch(`http://localhost:${PORT}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    }),
  });

  const sessionHeader = response.headers.get('mcp-session-id');
  const text = await response.text();

  // Parse SSE response
  let data = text;
  if (text.includes('event: message')) {
    const match = text.match(/data: (.+)/);
    if (match) data = match[1];
  }

  return { data: JSON.parse(data), sessionId: sessionHeader };
}

async function main() {
  console.log(`\n=== Testing MCP HTTP Server on port ${PORT} ===\n`);

  // 1. Initialize
  console.log('1. Initialize session...');
  const init = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0' },
  });
  const sessionId = init.sessionId;
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Server: ${init.data.result?.serverInfo?.name} v${init.data.result?.serverInfo?.version}`);

  // 2. List tools
  console.log('\n2. List tools...');
  const tools = await mcpRequest('tools/list', {}, sessionId);
  const toolNames = tools.data.result?.tools?.map(t => t.name) || [];
  console.log(`   Found ${toolNames.length} tools: ${toolNames.join(', ')}`);

  // 3. Call list_bases (passing API key as parameter)
  if (API_KEY) {
    console.log('\n3. Call list_bases (via parameter)...');
    const bases = await mcpRequest('tools/call', {
      name: 'list_bases',
      arguments: { airtableApiKey: API_KEY },
    }, sessionId);

    const content = bases.data.result?.content?.[0]?.text;
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.bases) {
        console.log(`   Found ${parsed.bases.length} bases:`);
        parsed.bases.forEach(b => console.log(`   - ${b.name} (${b.id})`));
      } else if (parsed.error) {
        console.log(`   Error: ${parsed.message}`);
      }
    }
  } else {
    console.log('\n3. Skipping list_bases (no AIRTABLE_API_KEY)');
  }

  console.log('\n=== HTTP Test Complete ===\n');
}

main().catch(console.error);
