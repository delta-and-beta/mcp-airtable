# Claude Desktop Configuration

This directory contains configuration examples for connecting Claude Desktop to the MCP Airtable server.

## Local Connection (STDIO)

For local development, use the standard STDIO transport:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/path/to/mcp-airtable/dist/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Or using npx:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "npx",
      "args": ["mcp-airtable"],
      "env": {
        "AIRTABLE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Remote Connection (HTTP)

To connect to a remote MCP server, use the MCP proxy:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-proxy",
        "https://your-server.com/mcp"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_auth_token_here"
      }
    }
  }
}
```

### Configuration Options

#### Server URL
Replace `https://your-server.com/mcp` with your actual server endpoint.

#### Authentication
The `MCP_AUTH_TOKEN` in the env section should match the token configured on your server. This is passed as a Bearer token in the Authorization header.

#### Custom Headers
If you need additional headers, you can use environment variables:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-proxy",
        "https://your-server.com/mcp"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_auth_token_here",
        "PROXY_HEADERS": "{\"X-Custom-Header\": \"value\"}"
      }
    }
  }
}
```

## Environment Variables

You can configure additional options through environment variables:

- `AIRTABLE_BASE_ID` - Default base ID for operations
- `ALLOWED_BASES` - Comma-separated list of allowed base IDs
- `ALLOWED_TABLES` - Comma-separated list of allowed tables
- `LOG_LEVEL` - Logging level (debug, info, warn, error)

## Security Notes

1. **Never commit** your `config.json` with real API keys
2. **Use strong tokens** for `MCP_AUTH_TOKEN` in production
3. **Enable HTTPS** for remote connections
4. **Rotate tokens** regularly

## Troubleshooting

### Connection Issues

1. **Check server health**: 
   ```bash
   curl https://your-server.com/health
   ```

2. **Verify authentication**:
   ```bash
   curl -H "Authorization: Bearer your_token" https://your-server.com/mcp
   ```

3. **Enable debug logging**:
   Add to env section:
   ```json
   "LOG_LEVEL": "debug"
   ```

### Common Errors

- **401 Unauthorized**: Check that MCP_AUTH_TOKEN matches server configuration
- **Connection refused**: Verify server is running and accessible
- **Timeout**: Check firewall rules and proxy settings

## Example Configurations

### Development Server
```json
{
  "mcpServers": {
    "airtable-dev": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-proxy",
        "http://localhost:3000/mcp"
      ],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Production Server with Access Control
```json
{
  "mcpServers": {
    "airtable-prod": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-proxy",
        "https://api.company.com/mcp"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "prod_token_here",
        "ALLOWED_BASES": "appProd1,appProd2",
        "ALLOWED_TABLES": "Customers,Orders"
      }
    }
  }
}
```