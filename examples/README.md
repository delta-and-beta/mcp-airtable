# MCP Airtable Configuration Examples

This server natively supports both **stdio** (local) and **Streamable HTTP** (remote) transports.

## Prerequisites

1. **Get your Airtable API Key**
   - Go to https://airtable.com/create/tokens
   - Create a Personal Access Token with required scopes
   - Token format: `patXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

---

## Option 1: Local (stdio) - Claude Desktop

**Best for:** Development, testing, single-user

### Setup

1. Build the server:
   ```bash
   git clone https://github.com/delta-and-beta/mcp-airtable.git
   cd mcp-airtable
   npm install && npm run build
   ```

2. Edit Claude Desktop config:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

3. Add the server configuration:

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-airtable/dist/index.js",
        "--stdio"
      ],
      "env": {
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX.YOUR_TOKEN_HERE"
      }
    }
  }
}
```

4. Restart Claude Desktop (Cmd+Q / Alt+F4, then reopen)

### How It Works

- Claude Desktop spawns the server as a subprocess
- Communication via stdin/stdout using JSON-RPC protocol
- The `--stdio` flag enables stdio transport mode
- API key passed via environment variable

---

## Option 2: Remote HTTP - Claude Desktop with mcp-remote

**Best for:** Production deployment, multi-user, remote access

### Setup

1. Start the HTTP server (or use deployed endpoint):
   ```bash
   cd mcp-airtable
   npm start  # Starts on port 3000
   ```

2. Configure Claude Desktop to use `mcp-remote`:

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://your-server.example.com/mcp",
        "--header",
        "x-airtable-api-key:patXXXXXXXXXXXXXX.YOUR_TOKEN_HERE",
        "--header",
        "x-airtable-workspace-id:wspXXXXXXXXXXXXXXX"
      ]
    }
  }
}
```

3. Restart Claude Desktop

### Headers

- `x-airtable-api-key` - Your Airtable Personal Access Token (required)
- `x-airtable-workspace-id` - Default workspace for create_base (optional)

### How It Works

- `mcp-remote` bridges stdio (Claude Desktop) to HTTP (server)
- API key and workspace ID passed via `--header` flags
- Server captures headers via FastMCP's `authenticate` callback
- Headers available to tools via `context.session.headers`

---

## Option 3: Remote HTTP - Claude.ai Web

**Best for:** Production, multi-user, cloud deployment

### Server Deployment

Deploy the server to any hosting provider:

```bash
# Start server (defaults to HTTP on port 3000)
npm start

# Or with custom port
PORT=8080 npm start
```

The server exposes a single MCP endpoint:
```
POST/GET https://your-server.com/mcp
```

### Connect via Claude.ai Custom Connector

1. Open [claude.ai](https://claude.ai) in your browser
2. Click profile icon → **Settings**
3. Select **Connectors** in sidebar
4. Click **Add custom connector**
5. Enter your server URL: `https://your-server.example.com/mcp`
6. Add header: `x-airtable-api-key: patXXXXX.XXXXX...`

---

## Authentication Best Practice (FastMCP)

This server follows FastMCP's recommended authentication pattern:

### Server-Side (authenticate callback)

The server uses FastMCP's `authenticate` callback to capture HTTP headers and store them in the session:

```typescript
const server = new FastMCP<SessionData>({
  name: "mcp-airtable",
  version: "1.0.0",
  authenticate: async (request): Promise<SessionData> => {
    // Capture HTTP headers and store in session
    return {
      headers: request.headers,
    };
  },
});
```

### Tool-Side (context.session.headers)

Tools access headers via `context.session.headers`:

```typescript
server.addTool({
  name: "list_bases",
  execute: async (args, context) => {
    // Access API key from session headers
    const apiKey = context.session?.headers?.["x-airtable-api-key"];
    // ...
  },
});
```

### Priority Order

**API key extraction (header > parameter > env):**
1. `x-airtable-api-key` HTTP header (via session - recommended)
2. `Authorization: Bearer <token>` header (OAuth-style)
3. `airtableApiKey` parameter in tool call (explicit override)
4. `AIRTABLE_API_KEY` environment variable (fallback)

**Workspace ID extraction (header > parameter > env):**
1. `x-airtable-workspace-id` HTTP header (via session - set once)
2. `workspaceId` parameter in tool call
3. `AIRTABLE_WORKSPACE_ID` environment variable (fallback)

---

## Deployment Examples

### Docker + Tailscale Funnel (Recommended)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
# IPv4 fix for Docker networking
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
CMD ["node", "dist/index.js"]
```

```bash
docker build -t mcp-airtable .
docker run -p 3000:3000 mcp-airtable

# With Sentry error tracking (optional)
docker run -p 3000:3000 \
  -e SENTRY_DSN=https://xxx@o0.ingest.sentry.io/0 \
  -e SENTRY_DEBUG=true \
  mcp-airtable

# Expose via Tailscale Funnel
tailscale funnel 3000
```

**Example deployment:** `https://your-server.example.com/mcp`

### Railway / Render / Fly.io

- Build: `npm run build`
- Start: `npm start`
- Port: `3000`

---

## Transport Comparison

| Feature | stdio (Local) | Streamable HTTP (Remote) |
|---------|---------------|--------------------------|
| Client | Claude Desktop | Claude.ai Web / mcp-remote |
| Transport | stdin/stdout | HTTP POST/GET |
| Multi-user | No | Yes |
| Requires hosting | No | Yes |
| Authentication | Environment variable | HTTP headers (session) |
| Session management | N/A | MCP-Session-Id header |

---

## Streamable HTTP Endpoint Details

The server implements the MCP 2025-11-25 Streamable HTTP specification:

### Endpoint
```
POST /mcp  - Send JSON-RPC messages (requests, notifications)
GET  /mcp  - Listen for server-initiated messages (optional)
```

### Required Headers (MCP 2025-11-25)

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `Accept` | Yes | `application/json, text/event-stream` |
| `MCP-Protocol-Version` | Yes | `2025-11-25` (on all requests) |
| `MCP-Session-Id` | After init | Session ID from server |
| `x-airtable-api-key` | Yes | Your Airtable API key |
| `x-airtable-workspace-id` | Optional | Default workspace for create_base |

### Request Format
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-11-25
x-airtable-api-key: patXXXXX.XXXXX...

{"jsonrpc":"2.0","method":"tools/list","id":1}
```

### Response Format
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"jsonrpc":"2.0","result":{"tools":[...]},"id":1}
```

---

## Troubleshooting

### Claude Desktop: "JSON parse error"
- Ensure `--stdio` flag is included in args
- Verify the path to `dist/index.js` is absolute and correct
- Check logs: `~/Library/Logs/Claude/mcp*.log` (macOS)

### mcp-remote: Connection refused
- Verify HTTP server is running on the specified port
- Check the URL is correct (include `/mcp` path)
- Ensure no firewall blocking the connection

### Remote: "AIRTABLE_API_KEY required"
- Verify header is passed: `--header "x-airtable-api-key:pat..."`
- Note: No space after colon in header format for mcp-remote
- For Claude.ai, add header in connector settings

---

## Security Notes

- **Never commit real API keys** to version control
- Use environment variables or secrets management
- For production, consider per-user authentication
- All examples use placeholder tokens: `patXXXXX...`

---

## References

- [MCP Specification (Latest)](https://modelcontextprotocol.io/specification/2025-11-25)
- [Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [FastMCP Authentication](https://github.com/punkpeye/fastmcp)
- [mcp-remote](https://www.npmjs.com/package/mcp-remote)
