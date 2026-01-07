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

## Option 2: Remote (Streamable HTTP) - Claude.ai Web

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
6. Complete authentication if prompted

### Authentication Options

The server accepts API keys via:

1. **HTTP Header** (recommended for remote):
   ```
   x-airtable-api-key: patXXXXX.XXXXX...
   ```

2. **Authorization Bearer** (OAuth-style):
   ```
   Authorization: Bearer patXXXXX.XXXXX...
   ```

3. **Per-request parameter**:
   ```json
   { "airtableApiKey": "patXXXXX.XXXXX..." }
   ```

---

## Option 3: Remote with Claude Desktop

For Claude Desktop to connect to a remote HTTP server, you can use environment-based configuration:

```json
{
  "mcpServers": {
    "mcp-airtable-remote": {
      "command": "node",
      "args": [
        "/path/to/mcp-airtable/dist/index.js",
        "--stdio"
      ],
      "env": {
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX.YOUR_TOKEN_HERE",
        "MCP_PROXY_URL": "https://your-server.example.com/mcp"
      }
    }
  }
}
```

Or run a local instance that connects to your remote Airtable data - the server itself handles the Airtable API calls.

---

## Deployment Examples

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
docker build -t mcp-airtable .
docker run -p 3000:3000 mcp-airtable
```

### Zeabur

```bash
npx zeabur deploy
```

### Railway / Render / Fly.io

- Build: `npm run build`
- Start: `npm start`
- Port: `3000`

---

## Transport Comparison

| Feature | stdio (Local) | Streamable HTTP (Remote) |
|---------|---------------|--------------------------|
| Client | Claude Desktop | Claude.ai Web / Any MCP Client |
| Transport | stdin/stdout | HTTP POST/GET + SSE |
| Multi-user | No | Yes |
| Requires hosting | No | Yes |
| Authentication | Environment variable | HTTP headers |
| Session management | N/A | Mcp-Session-Id header |

---

## Streamable HTTP Endpoint Details

The server implements the MCP 2025-03-26 Streamable HTTP specification:

### Endpoint
```
POST /mcp  - Send JSON-RPC messages (requests, notifications)
GET  /mcp  - Listen for server-initiated messages (SSE stream)
```

### Request Format
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
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

### Remote: Connection refused
- Verify server is running and accessible
- Check HTTPS certificate is valid
- Ensure firewall allows inbound connections on your port

### "AIRTABLE_API_KEY required"
- Local: Add to `env` block in config
- Remote: Pass via `x-airtable-api-key` header

---

## Security Notes

- **Never commit real API keys** to version control
- Use environment variables or secrets management
- For production, consider per-user authentication
- All examples use placeholder tokens: `patXXXXX...`

---

## References

- [MCP Specification 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26)
- [Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [Connect Remote Servers](https://modelcontextprotocol.io/docs/develop/connect-remote-servers)
