# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the MCP Airtable server.

## Quick Diagnostics

### 1. Check Server Health

```bash
# For local server
curl http://localhost:3000/health

# For remote server
curl https://your-server.com/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "mcp-airtable",
  "version": "1.0.0"
}
```

### 2. Verify Environment

```bash
# Check required variables
node -e "
const required = ['AIRTABLE_API_KEY'];
const missing = required.filter(v => !process.env[v]);
if (missing.length) {
  console.error('Missing:', missing);
  process.exit(1);
} else {
  console.log('Environment OK');
}
"
```

### 3. Test Airtable Connection

```bash
# Test API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.airtable.com/v0/meta/bases
```

## Common Issues

### Installation Issues

#### **Problem: npm install fails**

**Symptoms:**
- Package installation errors
- Node version warnings
- Permission denied errors

**Solutions:**

1. Check Node.js version:
   ```bash
   node --version  # Should be 18.0.0 or higher
   ```

2. Clear npm cache:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Use correct npm registry:
   ```bash
   npm config set registry https://registry.npmjs.org/
   ```

#### **Problem: Build fails with TypeScript errors**

**Solutions:**

1. Clean build:
   ```bash
   rm -rf dist
   npm run build
   ```

2. Check TypeScript version:
   ```bash
   npm ls typescript
   ```

### Configuration Issues

#### **Problem: "Airtable API key is required" error**

**Symptoms:**
- Server fails to start
- Error on first API call

**Solutions:**

1. Check environment variable name:
   ```bash
   # Correct
   AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
   
   # Common mistakes
   AIRTABLE_KEY=...         # Wrong name
   AIRTABLE_API_KEY="..."   # Don't use quotes in .env
   ```

2. Verify .env file is loaded:
   ```javascript
   // Add to top of index.ts
   console.log('API Key exists:', !!process.env.AIRTABLE_API_KEY);
   ```

3. Check file location:
   ```bash
   # .env must be in project root
   ls -la .env
   ```

#### **Problem: "Invalid base ID format" error**

**Symptoms:**
- Validation error when using tools
- Base ID rejected

**Solutions:**

1. Verify format:
   ```javascript
   // Valid: appXXXXXXXXXXXXXX (app + 14 chars)
   const valid = /^app[a-zA-Z0-9]{14}$/.test(baseId);
   ```

2. Check for hidden characters:
   ```bash
   # Remove whitespace
   echo -n "$AIRTABLE_BASE_ID" | od -c
   ```

### Authentication Issues

#### **Problem: 401 Unauthorized errors**

**Symptoms:**
- Remote MCP connection fails
- "Authentication required" errors

**Solutions:**

1. Verify token format:
   ```json
   // Claude Desktop config
   {
     "headers": {
       "Authorization": "Bearer your-token"  // Note the space after Bearer
     }
   }
   ```

2. Check token on server:
   ```bash
   # Server .env
   MCP_AUTH_TOKEN=your-token  # No "Bearer" prefix here
   ```

3. Test authentication:
   ```bash
   curl -H "Authorization: Bearer your-token" \
     https://your-server/health
   ```

#### **Problem: Airtable API authentication fails**

**Solutions:**

1. Verify API key validity:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.airtable.com/v0/meta/bases
   ```

2. Check key permissions:
   - Go to [Airtable Account](https://airtable.com/account)
   - Verify token has required scopes

3. Regenerate token if needed

### Connection Issues

#### **Problem: "Connection refused" errors**

**Symptoms:**
- Can't connect to local server
- Claude Desktop shows connection errors

**Solutions:**

1. Check if server is running:
   ```bash
   ps aux | grep node
   lsof -i :3000
   ```

2. Verify port availability:
   ```bash
   # Kill process using port
   kill -9 $(lsof -t -i:3000)
   ```

3. Check firewall:
   ```bash
   # macOS
   sudo pfctl -sr
   
   # Linux
   sudo iptables -L
   ```

#### **Problem: SSE connection drops**

**Symptoms:**
- Intermittent disconnections
- "Connection reset" errors

**Solutions:**

1. Check timeout settings:
   ```nginx
   # Nginx config for SSE
   proxy_read_timeout 86400;
   proxy_buffering off;
   proxy_cache off;
   ```

2. Enable keep-alive:
   ```javascript
   // Server configuration
   app.use((req, res, next) => {
     res.setHeader('Connection', 'keep-alive');
     res.setHeader('Cache-Control', 'no-cache');
     next();
   });
   ```

### Rate Limiting Issues

#### **Problem: Rate limit exceeded errors**

**Symptoms:**
- 429 errors from Airtable
- "RATE_LIMIT_ERROR" responses

**Solutions:**

1. Check request frequency:
   ```javascript
   // Maximum 5 requests/second per base
   const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
   await delay(200); // Wait 200ms between requests
   ```

2. Implement retry logic:
   ```javascript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.code === 'RATE_LIMIT_ERROR' && i < maxRetries - 1) {
           await delay(Math.pow(2, i) * 1000);
           continue;
         }
         throw error;
       }
     }
   }
   ```

### S3 Upload Issues

#### **Problem: Attachment upload fails**

**Symptoms:**
- "S3 client not configured" error
- Upload timeouts

**Solutions:**

1. Verify S3 configuration:
   ```bash
   # All required for S3
   echo "Bucket: $AWS_S3_BUCKET"
   echo "Key ID: $AWS_ACCESS_KEY_ID"
   echo "Has Secret: $([ -n "$AWS_SECRET_ACCESS_KEY" ] && echo 'Yes' || echo 'No')"
   ```

2. Test S3 access:
   ```bash
   aws s3 ls s3://$AWS_S3_BUCKET --region $AWS_REGION
   ```

3. Check IAM permissions:
   ```json
   {
     "Action": ["s3:PutObject", "s3:GetObject"],
     "Resource": "arn:aws:s3:::bucket-name/*"
   }
   ```

### Performance Issues

#### **Problem: Slow response times**

**Solutions:**

1. Enable debug logging:
   ```bash
   NODE_ENV=development LOG_LEVEL=debug npm run dev
   ```

2. Check Airtable base size:
   - Large bases may be slow
   - Use filtering and pagination

3. Monitor memory usage:
   ```bash
   # During operation
   ps aux | grep node
   ```

#### **Problem: Memory leaks**

**Symptoms:**
- Increasing memory usage
- Server crashes after time

**Solutions:**

1. Check for connection leaks:
   ```javascript
   // Ensure cleanup
   req.on('close', () => {
     // Clean up resources
   });
   ```

2. Monitor heap:
   ```bash
   node --inspect dist/server-sse.js
   # Open chrome://inspect
   ```

### Data Issues

#### **Problem: Records not found**

**Solutions:**

1. Check table name case:
   ```javascript
   // Airtable is case-sensitive
   "Contacts" !== "contacts"
   ```

2. Verify view permissions:
   - Some views may filter records
   - Check view configuration

3. Test without filters:
   ```json
   {
     "tool": "get_records",
     "arguments": {
       "tableName": "Contacts"
       // No filters
     }
   }
   ```

#### **Problem: Formula errors**

**Solutions:**

1. Test formula in Airtable UI first
2. Escape special characters:
   ```javascript
   // Escape quotes
   filterByFormula: "Name = 'O\\'Brien'"
   ```

3. Use proper field references:
   ```javascript
   // Correct
   "{Field Name}" // With spaces
   "FieldName"    // Without spaces
   ```

## Debug Techniques

### 1. Enable Verbose Logging

```bash
# Development mode with debug logs
NODE_ENV=development LOG_LEVEL=debug npm run dev
```

### 2. Use Request Inspection

```javascript
// Add to server code temporarily
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.body
  });
  next();
});
```

### 3. Test Individual Components

```javascript
// Test Airtable connection
import { AirtableClient } from './src/airtable/client.js';

const client = new AirtableClient({
  apiKey: process.env.AIRTABLE_API_KEY
});

client.listBases()
  .then(console.log)
  .catch(console.error);
```

### 4. Use cURL for Direct Testing

```bash
# Test tool directly
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "list_bases",
      "arguments": {}
    },
    "id": 1
  }'
```

## Error Reference

### Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `VALIDATION_ERROR` | Invalid input | Check parameters against API docs |
| `AUTHENTICATION_ERROR` | Auth failed | Verify tokens and API keys |
| `RATE_LIMIT_ERROR` | Too many requests | Implement backoff and retry |
| `AIRTABLE_ERROR` | Airtable API error | Check Airtable status and permissions |
| `INTERNAL_ERROR` | Server error | Check logs for details |

### Airtable Errors

| Status | Meaning | Solution |
|--------|---------|----------|
| 400 | Bad Request | Check formula syntax and field names |
| 401 | Unauthorized | Verify API key validity |
| 403 | Forbidden | Check base/table permissions |
| 404 | Not Found | Verify base/table/record IDs |
| 422 | Invalid Request | Check field types match schema |
| 429 | Rate Limited | Slow down requests |
| 500 | Server Error | Retry after delay |

## Getting Help

### 1. Gather Information

Before seeking help, collect:
- Error messages (full text)
- Log outputs
- Environment details
- Steps to reproduce

### 2. Check Resources

- GitHub Issues: Known problems
- Documentation: Configuration guides
- Airtable Status: Service outages

### 3. Report Issues

When reporting issues, include:

```markdown
**Environment:**
- OS: macOS/Linux/Windows
- Node version: X.X.X
- MCP Airtable version: X.X.X

**Configuration:**
- Transport: stdio/sse
- Deployment: local/Zeabur/Docker

**Error:**
```
[paste full error]
```

**Steps to reproduce:**
1. ...
2. ...

**Expected behavior:**
...

**Actual behavior:**
...
```

## Prevention Tips

1. **Test in staging first**
2. **Monitor logs regularly**
3. **Set up alerts for errors**
4. **Keep dependencies updated**
5. **Document your configuration**
6. **Regular backups of .env files**
7. **Use version control (not for secrets)**