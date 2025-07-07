#!/bin/bash

echo "Testing Zeabur MCP Authentication"
echo "================================="

URL="https://caissa-mcp-airtable.zeabur.app"
TOKEN="c74fcaec04bf90aa7bf2ad35c52d0f95289bf0889e3bfa00c9a79c09fe390f1a"

echo -e "\n1. Testing health endpoint (no auth required):"
curl -s "$URL/health" | jq . || echo "Failed to connect"

echo -e "\n2. Testing SSE endpoint WITHOUT auth:"
curl -i -H "Accept: text/event-stream" "$URL/mcp" 2>&1 | head -20

echo -e "\n3. Testing SSE endpoint WITH Bearer token:"
curl -i -H "Accept: text/event-stream" -H "Authorization: Bearer $TOKEN" "$URL/mcp" 2>&1 | head -20

echo -e "\n4. Testing SSE endpoint with just token (no Bearer):"
curl -i -H "Accept: text/event-stream" -H "Authorization: $TOKEN" "$URL/mcp" 2>&1 | head -20

echo -e "\n5. Testing with X-Auth-Token header:"
curl -i -H "Accept: text/event-stream" -H "X-Auth-Token: $TOKEN" "$URL/mcp" 2>&1 | head -20

echo -e "\nDone. Check which authentication method works above."