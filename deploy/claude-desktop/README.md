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

To connect to a remote MCP server, use mcp-remote with header-based authentication:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote",
        "https://your-server.com/mcp",
        "--header",
        "X-Airtable-Api-Key: your_airtable_api_key"
      ]
    }
  }
}
```

Or with both MCP authentication and Airtable API key:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote",
        "https://your-server.com/mcp",
        "--header",
        "Authorization: Bearer your_mcp_auth_token",
        "--header",
        "X-Airtable-Api-Key: your_airtable_api_key"
      ]
    }
  }
}
```

### Configuration Options

#### Server URL
Replace `https://your-server.com/mcp` with your actual server endpoint.

#### Authentication
You can pass authentication tokens via headers:
- `Authorization: Bearer <token>` - For MCP server authentication
- `X-Airtable-Api-Key: <key>` - For Airtable API authentication
- `X-Airtable-Base-Id: <id>` - Optional default base ID

#### Header Options
The server supports multiple ways to pass the Airtable API key:

1. **X-Airtable-Api-Key header**:
   ```json
   "--header", "X-Airtable-Api-Key: patXXXXXXXXXXXXXX"
   ```

2. **Authorization header with PAT**:
   ```json
   "--header", "Authorization: Bearer patXXXXXXXXXXXXXX"
   ```

3. **Multiple headers**:
   ```json
   "--header", "Authorization: Bearer mcp_auth_token",
   "--header", "X-Airtable-Api-Key: your_airtable_key",
   "--header", "X-Airtable-Base-Id: appXXXXXXXXXXXXXX"
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
        "@mcp/mcp-remote",
        "http://localhost:3000/mcp",
        "--header",
        "X-Airtable-Api-Key: your_dev_api_key"
      ]
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
        "@mcp/mcp-remote",
        "https://api.company.com/mcp",
        "--header",
        "Authorization: Bearer prod_mcp_token",
        "--header",
        "X-Airtable-Api-Key: prod_airtable_key"
      ]
    }
  }
}
```

### Multiple Base Access
```json
{
  "mcpServers": {
    "airtable-personal": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote",
        "https://mcp.example.com/mcp",
        "--header",
        "X-Airtable-Api-Key: personal_api_key",
        "--header",
        "X-Airtable-Base-Id: appPersonalBase"
      ]
    },
    "airtable-work": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote",
        "https://mcp.example.com/mcp",
        "--header",
        "X-Airtable-Api-Key: work_api_key",
        "--header",
        "X-Airtable-Base-Id: appWorkBase"
      ]
    }
  }
}
```