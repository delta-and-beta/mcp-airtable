#!/bin/bash

BASE_URL="https://caissa-mcp-airtable.zeabur.app"
TOKEN="c74fcaec04bf90aa7bf2ad35c52d0f95289bf0889e3bfa00c9a79c09fe390f1a"

echo "Testing n8n HTTP endpoints..."
echo

# Test initialize
echo "1. Testing initialize..."
curl -X POST "${BASE_URL}/mcp/n8n/${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 0,
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {
        "tools": {}
      },
      "clientInfo": {
        "name": "@n8n/n8n-nodes-langchain.mcpClientTool",
        "version": "1"
      }
    }
  }' | jq .

echo
echo "2. Testing tools/list..."
curl -X POST "${BASE_URL}/mcp/n8n/${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1,
    "params": {}
  }' | jq .

echo
echo "3. Testing HTTP Streamable endpoint..."
curl -X POST "${BASE_URL}/stream/n8n/${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 0,
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {
        "tools": {}
      },
      "clientInfo": {
        "name": "@n8n/n8n-nodes-langchain.mcpClientTool",
        "version": "1"
      }
    }
  }' | jq .