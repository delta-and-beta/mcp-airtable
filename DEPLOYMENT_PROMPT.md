# Deployment Prompt for Remote MCP Server

## Task

Deploy the clean FastMCP TypeScript Airtable MCP server to a cloud platform for remote access from Claude Desktop.

## Repository

**GitHub:** https://github.com/delta-and-beta/mcp-airtable
**Branch:** main
**Framework:** Node.js FastMCP (TypeScript)
**Current Status:** Production deployed via Tailscale Funnel at `https://mcp-airtable.tailb1bee0.ts.net/mcp`

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
AIRTABLE_API_KEY=                  # Server-level API key (use x-airtable-api-key header instead)
AIRTABLE_WORKSPACE_ID=             # Default workspace (use x-airtable-workspace-id header instead)
NODE_OPTIONS="--dns-result-order=ipv4first"  # IPv4 fix for Docker networking

# Sentry Error Tracking (Optional)
SENTRY_DSN=                        # Sentry DSN (leave empty to disable)
SENTRY_DEBUG=false                 # Set to true to capture ALL MCP requests
SENTRY_ENVIRONMENT=production      # Environment name
SENTRY_TRACES_SAMPLE_RATE=0.1      # Sample rate 0-1
```

**Note:** API keys and workspace IDs should come from Claude Desktop client headers (`x-airtable-api-key`, `x-airtable-workspace-id`), NOT from server environment variables. This allows multi-tenant usage.

### Dependencies

All in package.json:
- `fastmcp` - MCP framework
- `zod` - Validation
- `airtable` - Airtable SDK
- `dotenv` - Environment config
- `@sentry/node` - Error tracking (optional)

## Deployment Options

### Recommended: Docker + Tailscale Funnel (Currently Deployed)

```bash
# Build and run Docker container
docker build -t mcp-airtable .
docker run -p 3000:3000 -e NODE_OPTIONS="--dns-result-order=ipv4first" mcp-airtable

# Expose via Tailscale Funnel (automatic HTTPS)
tailscale funnel 3000
```

**Current production URL:** `https://mcp-airtable.tailb1bee0.ts.net/mcp`

### Alternative Platforms:

1. **Railway.app** (developer-friendly)
   - Auto-deploys from GitHub
   - Environment variables via UI
   - Free tier available

2. **Google Cloud Run** (scalable)
   - Serverless containers
   - Scales to zero
   - Pay per use

3. **Fly.io** (edge deployment)
   - Global edge locations
   - Good latency worldwide
   - Free tier available

### Deployment Steps (Cloud Platforms)

1. **Connect GitHub repository:** delta-and-beta/mcp-airtable
2. **Set build settings:**
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Port: 3000
   - Add `NODE_OPTIONS="--dns-result-order=ipv4first"` env var (IPv4 fix)
3. **Deploy** and wait for build
4. **Get deployment URL** (e.g., `https://mcp-airtable.railway.app`)
5. **Test health:** `curl https://your-url.com/mcp`

## Testing After Deployment

### 1. Test with curl

```bash
# Test MCP protocol
curl -X POST https://mcp-airtable.tailb1bee0.ts.net/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/list"
  }'
```

Expected: Returns list of 21 tools (list_workspaces, list_bases, create_base, get_records, etc.)

### 2. Test with Claude Desktop

Update `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp-airtable.tailb1bee0.ts.net/mcp",
        "--header",
        "x-airtable-api-key:YOUR_AIRTABLE_API_KEY",
        "--header",
        "x-airtable-workspace-id:YOUR_WORKSPACE_ID"
      ]
    }
  }
}
```

Replace:
- `YOUR_AIRTABLE_API_KEY` with your Airtable Personal Access Token
- `YOUR_WORKSPACE_ID` with your workspace ID (optional, for create_base)

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
- ✅ tools/list returns 21 tools
- ✅ Claude Desktop connects successfully
- ✅ Header-based authentication works (x-airtable-api-key, x-airtable-workspace-id)
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

This is a **clean, production-ready implementation** with:
- 21 Airtable tools (bases, tables, fields, records, batch, comments)
- Production security (formula injection prevention, path traversal blocking)
- Modern TypeScript with FastMCP framework
- ~1200 lines of code, 133 unit tests
- Header-based authentication (API key + workspace ID)
- Optional Sentry integration for error tracking and request monitoring

The server is **stateless** and designed for multi-tenant use via header-based authentication.

**Auth priority:** headers > parameter > environment variable

---

## Current Production Deployment

**URL:** `https://mcp-airtable.tailb1bee0.ts.net/mcp`
**Method:** Docker + Tailscale Funnel
**HTTPS:** Automatic via Tailscale
