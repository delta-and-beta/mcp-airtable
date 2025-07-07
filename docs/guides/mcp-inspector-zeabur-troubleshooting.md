# Troubleshooting MCP Inspector Connection to Zeabur

## Error: "Connection Error - Did you add the proxy session token in Configuration?"

This error typically occurs when MCP Inspector cannot establish an SSE connection to your Zeabur endpoint.

### Common Causes and Solutions

#### 1. Authentication Issues

If your server requires authentication but the token is missing or incorrect:

```bash
# Correct format with authentication
npx @modelcontextprotocol/inspector sse \
  --url "https://your-app.zeabur.app/mcp" \
  --headers '{"Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"}'

# Make sure to replace YOUR_MCP_AUTH_TOKEN with your actual token
```

#### 2. CORS Configuration

The SSE server might be rejecting the connection due to CORS. Check your Zeabur environment variables:

```bash
# In Zeabur, set:
CORS_ORIGIN=*
# Or for specific origin:
CORS_ORIGIN=http://localhost:5173
```

#### 3. URL Format Issues

Ensure your URL is correct:
- ✅ Correct: `https://your-app.zeabur.app/mcp`
- ❌ Wrong: `https://your-app.zeabur.app` (missing /mcp)
- ❌ Wrong: `https://your-app.zeabur.app/mcp/` (trailing slash)

#### 4. Server Not Running or Endpoint Issues

Test the endpoints directly:

```bash
# Test health endpoint first
curl https://your-app.zeabur.app/health

# Test SSE endpoint with curl
curl -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-app.zeabur.app/mcp
```

#### 5. Headers Format in MCP Inspector

The headers must be valid JSON:

```bash
# ✅ Correct - valid JSON
--headers '{"Authorization": "Bearer YOUR_TOKEN"}'

# ❌ Wrong - missing quotes
--headers {Authorization: Bearer YOUR_TOKEN}

# ❌ Wrong - single quotes inside
--headers "{'Authorization': 'Bearer YOUR_TOKEN'}"
```

### Quick Debugging Steps

1. **Verify Server is Running:**
   ```bash
   curl https://your-app.zeabur.app/health
   ```
   Should return `{"status":"ok",...}`

2. **Test SSE Without MCP Inspector:**
   ```bash
   # Without auth
   curl -N -H "Accept: text/event-stream" https://your-app.zeabur.app/mcp

   # With auth
   curl -N -H "Accept: text/event-stream" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-app.zeabur.app/mcp
   ```
   Should show SSE events like `event: open`

3. **Check Zeabur Logs:**
   - Go to Zeabur dashboard
   - Check logs for connection attempts
   - Look for authentication or CORS errors

4. **Try Without Authentication First:**
   If you haven't set `MCP_AUTH_TOKEN` in Zeabur:
   ```bash
   npx @modelcontextprotocol/inspector sse \
     --url "https://your-app.zeabur.app/mcp"
   ```

### Environment Variables Checklist

Ensure these are set in Zeabur:

```bash
# Required
AIRTABLE_API_KEY=your_airtable_api_key

# For authentication (if using)
MCP_AUTH_TOKEN=your_secret_token

# For CORS (if needed)
CORS_ORIGIN=*

# Optional
NODE_ENV=production
# Note: PORT is automatically set by Zeabur (usually 8080)
# Do NOT manually set PORT in Zeabur
```

### Alternative Testing Method

If MCP Inspector continues to fail, use a simple Node.js script:

```javascript
// save as test-sse.js
const EventSource = require('eventsource');

const url = 'https://your-app.zeabur.app/mcp';
const options = {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
};

const es = new EventSource(url, options);

es.onopen = () => console.log('Connected!');
es.onmessage = (e) => console.log('Message:', e.data);
es.onerror = (e) => console.error('Error:', e);

// Run with: npm install eventsource && node test-sse.js
```

### Still Having Issues?

1. **Check if it's a proxy issue:** Some corporate networks block SSE
2. **Try a different browser:** Some browsers handle SSE differently
3. **Verify HTTPS:** Zeabur should provide HTTPS by default
4. **Check for typos:** In the URL, token, or headers format