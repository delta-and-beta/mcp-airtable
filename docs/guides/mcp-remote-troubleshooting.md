# MCP-Remote Troubleshooting Guide

This guide helps resolve common issues when connecting Claude Desktop to remote MCP servers.

## Quick Diagnostics

### 1. Test Server Health

```bash
# Basic health check
curl https://your-server.com/health

# Expected response:
{
  "status": "ok",
  "service": "mcp-airtable",
  "version": "1.0.0",
  "transport": "http"
}
```

### 2. Test Authentication

```bash
# Test with your MCP auth token
curl -X POST https://your-server.com/mcp \
  -H "Authorization: Bearer YOUR_MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "initialize", "params": {}, "id": 1}'
```

### 3. Test Tool Listing

```bash
curl -X POST https://your-server.com/mcp \
  -H "Authorization: Bearer YOUR_MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 2}'
```

## Common Error Messages

### "Connection refused" or "ECONNREFUSED"

**Symptoms:**
- Claude shows "Failed to connect to server"
- Connection timeout errors

**Solutions:**
1. Verify server is running:
   ```bash
   # On server
   ps aux | grep node
   netstat -tlnp | grep 3000
   ```

2. Check firewall rules:
   ```bash
   # Allow port 3000
   sudo ufw allow 3000/tcp
   ```

3. Verify URL format:
   ```json
   // Correct
   "args": ["connect", "https://server.com/mcp"]
   
   // Incorrect
   "args": ["https://server.com/mcp"]  // Missing "connect"
   ```

### "401 Unauthorized"

**Symptoms:**
- Server responds but rejects requests
- "Invalid token" errors

**Solutions:**
1. Verify token matches:
   ```bash
   # Server .env
   MCP_AUTH_TOKEN=abc123
   
   # Claude config must match
   "env": {
     "MCP_AUTH_TOKEN": "abc123"
   }
   ```

2. Check token format:
   ```bash
   # No spaces or quotes in the actual token
   MCP_AUTH_TOKEN=abc123  # ✓ Correct
   MCP_AUTH_TOKEN="abc123"  # ✗ Wrong (unless quotes are part of token)
   ```

### "Protocol version mismatch"

**Symptoms:**
- "Server's protocol version is not supported"

**Solutions:**
1. Update mcp-remote:
   ```bash
   npm install -g mcp-remote@latest
   ```

2. Verify server protocol version:
   ```javascript
   // In server.ts
   protocolVersion: '2024-11-05'  // Current version
   ```

### "CORS error" or "Blocked by CORS policy"

**Symptoms:**
- Works with curl but not Claude Desktop
- Browser console shows CORS errors

**Solutions:**
1. Configure server CORS:
   ```bash
   # Server .env
   CORS_ORIGIN=*  # For development
   # OR
   CORS_ORIGIN=https://claude.ai  # For production
   ```

2. Check proxy headers:
   ```json
   "env": {
     "MCP_REMOTE_HEADERS": "{\"Origin\": \"https://claude.ai\"}"
   }
   ```

### "SSL certificate problem"

**Symptoms:**
- "unable to verify the first certificate"
- "self signed certificate" errors

**Solutions:**

1. For production - use valid certificates:
   ```nginx
   server {
     listen 443 ssl;
     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;
   }
   ```

2. For development only:
   ```json
   "env": {
     "NODE_TLS_REJECT_UNAUTHORIZED": "0"  // NEVER in production!
   }
   ```

### "Timeout" errors

**Symptoms:**
- Operations start but never complete
- "Request timeout" after 30 seconds

**Solutions:**
1. Increase timeout:
   ```json
   "env": {
     "MCP_REMOTE_TIMEOUT": "60000"  // 60 seconds
   }
   ```

2. Check server performance:
   ```bash
   # Monitor server resources
   top
   htop
   ```

### "Airtable API key not found"

**Symptoms:**
- "Airtable API key is required" error
- Tools fail with authentication errors

**Solutions:**

1. Using environment key:
   ```bash
   # Server .env
   AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
   ```

2. Using per-request key in Claude:
   ```
   "Using API key patXXXXXXXXXXXXXX and base appYYYYYYYYYYYYYY, list tables"
   ```

3. Debug API key extraction:
   ```bash
   # Server .env
   LOG_LEVEL=debug  # Shows API key detection
   ```

## Debug Mode

### Enable verbose logging in Claude config:

```json
{
  "mcpServers": {
    "airtable-debug": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "https://server.com/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "token",
        "DEBUG": "mcp-remote:*",
        "NODE_ENV": "development"
      }
    }
  }
}
```

### Enable server debug logging:

```bash
# Server .env
LOG_LEVEL=debug
NODE_ENV=development
```

## Network Debugging

### Using curl to simulate requests:

```bash
# List tables with per-request API key
curl -X POST https://your-server.com/mcp \
  -H "Authorization: Bearer YOUR_MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "list_tables",
      "arguments": {
        "baseId": "appXXXXXXXXXXXXXX",
        "apiKey": "patYYYYYYYYYYYYYY"
      }
    },
    "id": 3
  }'
```

### Using browser DevTools:

1. Open Claude Desktop DevTools (if available)
2. Check Network tab for failed requests
3. Look for CORS headers in responses

## Performance Optimization

### 1. Enable compression:

Most Node.js servers support gzip automatically, but verify:

```javascript
// In server setup
app.use(compression());
```

### 2. Connection pooling:

mcp-remote reuses connections, but you can tune:

```json
"env": {
  "MCP_REMOTE_MAX_SOCKETS": "10"
}
```

### 3. Rate limiting:

Ensure server has appropriate limits:

```bash
# Server .env
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

## Getting Help

If issues persist:

1. **Collect logs:**
   - Claude Desktop logs
   - Server logs (`pm2 logs`, `docker logs`, etc.)
   - Network traces

2. **Check versions:**
   ```bash
   npx mcp-remote --version
   node --version
   npm list @modelcontextprotocol/sdk
   ```

3. **Report issues:**
   - Include configuration (redact tokens!)
   - Include error messages
   - Include steps to reproduce