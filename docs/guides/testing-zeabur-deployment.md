# Testing MCP Airtable Server on Zeabur

This guide explains how to test your MCP Airtable server after deploying to Zeabur.

## Prerequisites

- Deployed MCP Airtable server on Zeabur
- Your Zeabur deployment URL (e.g., `https://your-app.zeabur.app`)
- MCP_AUTH_TOKEN if authentication is enabled
- curl or any HTTP client installed

**Note:** Zeabur automatically assigns ports (typically 8080). The server adapts to use `process.env.PORT` automatically.

## 1. Test Health Endpoint

First, verify the server is running by checking the health endpoint:

```bash
curl https://your-app.zeabur.app/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "mcp-airtable",
  "version": "1.0.0",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "environment": "production",
  "checks": {
    "airtable": { "status": "ok" },
    "s3": { "status": "ok" }
  }
}
```

## 2. Test SSE Connection

Test the MCP SSE endpoint (requires authentication if configured):

```bash
# Without authentication
curl -N -H "Accept: text/event-stream" \
  https://your-app.zeabur.app/mcp

# With authentication
curl -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR_MCP_AUTH_TOKEN" \
  https://your-app.zeabur.app/mcp
```

You should see SSE events starting with:
```
event: open
data: {"type":"open"}
```

## 3. Test with MCP Inspector

Use the MCP Inspector tool for interactive testing:

```bash
npx @modelcontextprotocol/inspector sse \
  --url "https://your-app.zeabur.app/mcp" \
  --headers '{"Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"}'
```

This opens a web interface where you can:
- View available tools
- Test tool execution
- See request/response data

## 4. Test Specific Tools

### List Bases
```bash
# Using curl with SSE client
npx @modelcontextprotocol/server-sse-client \
  --url "https://your-app.zeabur.app/mcp" \
  --headers '{"Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"}' \
  --tool list_bases
```

### Get Records
```bash
# Create a test script
cat > test-mcp.js << 'EOF'
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

async function testMCP() {
  const transport = new SSEClientTransport(
    new URL('https://your-app.zeabur.app/mcp'),
    { headers: { 'Authorization': 'Bearer YOUR_MCP_AUTH_TOKEN' } }
  );

  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  // List available tools
  const tools = await client.listTools();
  console.log('Available tools:', tools);

  // Test list_bases
  const result = await client.callTool('list_bases', {});
  console.log('Bases:', result);

  await client.close();
}

testMCP().catch(console.error);
EOF

npm install @modelcontextprotocol/sdk
node test-mcp.js
```

## 5. Test with Claude Desktop

Configure Claude Desktop to use your Zeabur deployment:

1. Edit Claude Desktop config:
   ```json
   {
     "mcpServers": {
       "airtable-zeabur": {
         "command": "npx",
         "args": [
           "-y",
           "@modelcontextprotocol/server-sse-client",
           "https://your-app.zeabur.app/mcp"
         ],
         "env": {
           "MCP_SSE_AUTH_HEADER": "Bearer YOUR_MCP_AUTH_TOKEN"
         }
       }
     }
   }
   ```

2. Restart Claude Desktop

3. In Claude, test with:
   ```
   Can you list my Airtable bases using the airtable-zeabur tool?
   ```

## 6. Monitor Logs

Check Zeabur logs for any errors:

1. Go to Zeabur dashboard
2. Select your service
3. Click on "Logs" tab
4. Look for:
   - Connection logs: "New MCP SSE connection"
   - Tool execution logs: "Executing tool: list_bases"
   - Error logs: Any error messages

## 7. Common Issues and Solutions

### 401 Unauthorized
- Check MCP_AUTH_TOKEN is set correctly in Zeabur
- Verify token in Authorization header matches

### 500 Internal Server Error
- Check AIRTABLE_API_KEY is set in Zeabur
- Verify Airtable API key has proper permissions

### Connection Timeout
- Ensure your Zeabur app is running
- Check if custom domain is properly configured
- Verify HTTPS is enabled

### CORS Issues
- Set CORS_ORIGIN environment variable if needed
- Default is `*` (allow all origins)

## 8. Performance Testing

Test response times and rate limiting:

```bash
# Single request timing
time curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-app.zeabur.app/health

# Load test (be careful with rate limits)
for i in {1..10}; do
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    https://your-app.zeabur.app/health &
done
wait
```

## 9. Test Attachment Upload (if S3/GCS configured)

```javascript
// Test file upload
const testUpload = await client.callTool('upload_attachment', {
  base64Data: Buffer.from('Hello World').toString('base64'),
  filename: 'test.txt',
  contentType: 'text/plain'
});
console.log('Upload result:', testUpload);
```

## Debugging Tips

1. **Enable Debug Logs**: Set `LOG_LEVEL=debug` in Zeabur environment
2. **Test Locally First**: Run `npm run start:sse` locally to debug
3. **Check Network**: Use browser DevTools to inspect SSE connections
4. **Validate Config**: Ensure all required env vars are set in Zeabur

## Success Criteria

Your deployment is working correctly when:
- ✅ Health endpoint returns `{"status": "ok"}`
- ✅ SSE connection establishes without errors
- ✅ Tool listing shows all expected tools
- ✅ Basic operations (list_bases, get_records) work
- ✅ Authentication works (if configured)
- ✅ No errors in Zeabur logs