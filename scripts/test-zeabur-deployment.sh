#!/bin/bash

# Test script for Zeabur-deployed MCP Airtable server
# Usage: ./test-zeabur-deployment.sh <ZEABUR_URL> [AUTH_TOKEN]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <ZEABUR_URL> [AUTH_TOKEN]"
    echo "Example: $0 https://mcp-airtable.zeabur.app your-secret-token"
    exit 1
fi

ZEABUR_URL="${1%/}"  # Remove trailing slash if present
AUTH_TOKEN="$2"

echo "Testing MCP Airtable server at: $ZEABUR_URL"
echo "================================================"

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        return 1
    fi
}

# Test 1: Health Check
echo -e "\n${YELLOW}1. Testing Health Endpoint${NC}"
if HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$ZEABUR_URL/health" 2>/dev/null); then
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
    BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_result 0 "Health check passed (HTTP $HTTP_CODE)"
        echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    else
        print_result 1 "Health check failed (HTTP $HTTP_CODE)"
        echo "$BODY"
    fi
else
    print_result 1 "Failed to connect to health endpoint"
fi

# Test 2: SSE Connection
echo -e "\n${YELLOW}2. Testing SSE Connection${NC}"
AUTH_HEADER=""
if [ -n "$AUTH_TOKEN" ]; then
    AUTH_HEADER="-H \"Authorization: Bearer $AUTH_TOKEN\""
fi

# Test SSE connection (timeout after 5 seconds)
echo "Attempting SSE connection..."
if [ -n "$AUTH_TOKEN" ]; then
    SSE_TEST=$(timeout 5 curl -s -N -H "Accept: text/event-stream" -H "Authorization: Bearer $AUTH_TOKEN" "$ZEABUR_URL/mcp" 2>&1 | head -n 5)
else
    SSE_TEST=$(timeout 5 curl -s -N -H "Accept: text/event-stream" "$ZEABUR_URL/mcp" 2>&1 | head -n 5)
fi

if echo "$SSE_TEST" | grep -q "event: open\|data:"; then
    print_result 0 "SSE connection established"
    echo "$SSE_TEST" | head -n 3
elif echo "$SSE_TEST" | grep -q "401\|Unauthorized"; then
    print_result 1 "Authentication failed - check your AUTH_TOKEN"
else
    print_result 1 "SSE connection failed"
    echo "$SSE_TEST"
fi

# Test 3: Check if MCP Inspector is available
echo -e "\n${YELLOW}3. MCP Inspector Command${NC}"
if command -v npx &> /dev/null; then
    echo "To test interactively with MCP Inspector, run:"
    if [ -n "$AUTH_TOKEN" ]; then
        echo -e "${GREEN}npx @modelcontextprotocol/inspector sse --url \"$ZEABUR_URL/mcp\" --headers '{\"Authorization\": \"Bearer $AUTH_TOKEN\"}'${NC}"
    else
        echo -e "${GREEN}npx @modelcontextprotocol/inspector sse --url \"$ZEABUR_URL/mcp\"${NC}"
    fi
else
    echo "npx not found - install Node.js to use MCP Inspector"
fi

# Test 4: Test with actual MCP client (if possible)
echo -e "\n${YELLOW}4. Testing MCP Tools (requires @modelcontextprotocol/sdk)${NC}"

# Create a temporary test script
cat > /tmp/test-mcp-zeabur.js << EOF
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

async function testMCP() {
  const url = '${ZEABUR_URL}/mcp';
  const headers = {};
  
  if ('${AUTH_TOKEN}') {
    headers['Authorization'] = 'Bearer ${AUTH_TOKEN}';
  }

  console.log('Connecting to:', url);
  
  try {
    const transport = new SSEClientTransport(new URL(url), { headers });
    const client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );
    
    await client.connect(transport);
    console.log('✓ Connected successfully');
    
    // List tools
    const tools = await client.listTools();
    console.log('\\n✓ Available tools:', tools.tools.length);
    tools.tools.slice(0, 5).forEach(tool => {
      console.log('  -', tool.name);
    });
    
    // Test list_bases
    try {
      console.log('\\n✓ Testing list_bases tool...');
      const result = await client.callTool('list_bases', {});
      console.log('  Response received:', result.content[0].text ? 'Success' : 'Unknown format');
    } catch (error) {
      console.log('  ✗ Error:', error.message);
    }
    
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    process.exit(1);
  }
}

testMCP();
EOF

# Check if MCP SDK is available globally or install temporarily
if npm list -g @modelcontextprotocol/sdk &>/dev/null || npm list @modelcontextprotocol/sdk &>/dev/null; then
    echo "Running MCP client test..."
    node /tmp/test-mcp-zeabur.js
else
    echo "MCP SDK not found. To run this test, install it with:"
    echo -e "${YELLOW}npm install -g @modelcontextprotocol/sdk${NC}"
    echo "Then run: node /tmp/test-mcp-zeabur.js"
fi

# Summary
echo -e "\n${YELLOW}Summary${NC}"
echo "======="
echo "Server URL: $ZEABUR_URL"
echo "Authentication: $([ -n "$AUTH_TOKEN" ] && echo "Configured" || echo "Not configured")"
echo -e "\n${GREEN}Next steps:${NC}"
echo "1. Check Zeabur logs for any server errors"
echo "2. Configure Claude Desktop with the SSE client"
echo "3. Test actual Airtable operations with your API key"

# Cleanup
rm -f /tmp/test-mcp-zeabur.js