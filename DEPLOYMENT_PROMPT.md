# Deployment Prompt for Remote MCP Server

## Task

Deploy the clean FastMCP TypeScript Airtable MCP server to a cloud platform for remote access from Claude Desktop.

## Repository

**GitHub:** https://github.com/delta-and-beta/mcp-airtable  
**Branch:** main  
**Framework:** Node.js FastMCP (TypeScript)  
**Current Status:** Tested and working locally on http://localhost:3000/mcp

## Requirements

### Application Details

- **Runtime:** Node.js 20+
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start` (runs `node dist/index.js`)
- **Port:** 3000 (configurable via PORT env var)
- **Health Check:** `/health` endpoint (if available) or check port 3000 responds
- **Protocol:** HTTP with streamable-HTTP transport on `/mcp` endpoint

### Environment Variables

**Optional (recommended for production):**
```bash
PORT=3000                          # Server port
NODE_ENV=production                # Environment mode
AIRTABLE_API_KEY=                  # Server-level API key (optional - can use headers)
```

**Note:** API keys should primarily come from Claude Desktop client headers (`x-airtable-api-key`), NOT from server environment variables. This allows multi-tenant usage.

### Dependencies

All in package.json:
- `fastmcp` - MCP framework
- `zod` - Validation
- `airtable` - Airtable SDK
- `dotenv` - Environment config

## Deployment Options

### Recommended Platforms (pick one):

1. **Zeabur** (easiest, zero config)
   - Supports Node.js auto-detection
   - Free tier available
   - Good for Asia/Global deployment

2. **Railway.app** (developer-friendly)
   - Auto-deploys from GitHub
   - Environment variables via UI
   - Free tier available

3. **Google Cloud Run** (scalable)
   - Serverless containers
   - Scales to zero
   - Pay per use

4. **Fly.io** (edge deployment)
   - Global edge locations
   - Good latency worldwide
   - Free tier available

### Deployment Steps (General)

1. **Connect GitHub repository:** delta-and-beta/mcp-airtable
2. **Set build settings:**
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Port: 3000
3. **Deploy** and wait for build
4. **Get deployment URL** (e.g., `https://mcp-airtable-xyz.zeabur.app`)
5. **Test health:** `curl https://your-url.com/mcp`

## Testing After Deployment

### 1. Test with curl

```bash
# Test MCP protocol
curl -X POST https://your-deployment-url.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/list"
  }'
```

Expected: Returns list of 10 tools (list_bases, list_tables, get_records, etc.)

### 2. Test with Claude Desktop

Update `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://your-deployment-url.com/mcp",
        "--header",
        "x-airtable-api-key:YOUR_AIRTABLE_API_KEY"
      ]
    }
  }
}
```

Replace:
- `https://your-deployment-url.com/mcp` with actual deployment URL
- `YOUR_AIRTABLE_API_KEY` with your Airtable Personal Access Token

### 3. Test in Claude Desktop

Restart Claude Desktop and try:
```
"List my Airtable bases"
"Show tables in base appXXXXX"
"Get 5 records from Tasks table"
```

## Success Criteria

- ✅ Deployment builds successfully
- ✅ Server responds on `/mcp` endpoint
- ✅ tools/list returns 10 tools
- ✅ Claude Desktop connects successfully
- ✅ Header-based API key authentication works
- ✅ Tools execute and return Airtable data

## Security Notes

- **API Keys:** Should come from client headers, NOT stored on server
- **HTTPS:** Required for production (MCP servers should use HTTPS)
- **CORS:** FastMCP enables CORS by default
- **Rate Limiting:** Consider adding platform-level rate limiting

## Troubleshooting

**Build fails:**
- Ensure Node.js 20+ is used
- Check npm install succeeds
- Verify TypeScript compiles: `npm run build`

**Server won't start:**
- Check PORT environment variable
- Verify npm start command runs
- Check logs for errors

**Claude Desktop can't connect:**
- Verify URL is HTTPS (not HTTP)
- Check `/mcp` endpoint responds
- Verify headers are being sent
- Check deployment logs for auth errors

## Additional Context

This is a **clean, minimal implementation** with:
- 10 essential Airtable tools
- Production security (formula injection prevention, path traversal blocking)
- Modern TypeScript with FastMCP framework
- ~450 lines of code total

The server is **stateless** and designed for multi-tenant use via header-based authentication.

---

## Output Required

After deployment, provide:
1. **Deployment URL** (the `/mcp` endpoint)
2. **Claude Desktop config** (pre-filled with the URL)
3. **Test results** (curl test showing tools/list works)

Good luck! 🚀
