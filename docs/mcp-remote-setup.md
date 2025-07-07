# MCP Remote Setup with Header Authentication

This guide explains how to configure MCP Airtable server with mcp-remote, including how to pass the Airtable API key via headers.

## Overview

When using mcp-remote to connect Claude Desktop to a remote MCP server, you can pass the Airtable API key in several ways:

1. **Environment variables on the server** (less flexible)
2. **Per-request in tool arguments** (supported but verbose)
3. **Via HTTP headers** (recommended for mcp-remote)

## Header-Based Authentication

The MCP Airtable server supports extracting the Airtable API key from HTTP headers, making it easy to use with mcp-remote without hardcoding credentials.

### Supported Headers

The server checks for the API key in these headers (in order):

1. `X-Airtable-Api-Key: your_api_key`
2. `Authorization: Bearer pat...` (Airtable Personal Access Token)

### Claude Desktop Configuration

Configure your Claude Desktop to use mcp-remote with custom headers:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote", 
        "http://your-server-url:3000/mcp",
        "--header",
        "X-Airtable-Api-Key: your_airtable_api_key_here"
      ]
    }
  }
}
```

Or using the Authorization header:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote", 
        "http://your-server-url:3000/mcp",
        "--header",
        "Authorization: Bearer patXXXXXXXXXXXXXXXX"
      ]
    }
  }
}
```

### Multiple Headers

You can pass both the API key and base ID via headers:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote", 
        "http://your-server-url:3000/mcp",
        "--header",
        "X-Airtable-Api-Key: your_api_key_here",
        "--header", 
        "X-Airtable-Base-Id: appXXXXXXXXXXXXXX"
      ]
    }
  }
}
```

### With MCP Authentication

If your MCP server requires authentication (recommended for production), add the MCP auth token:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote", 
        "http://your-server-url:3000/mcp",
        "--header",
        "Authorization: Bearer your_mcp_auth_token",
        "--header",
        "X-Airtable-Api-Key: your_airtable_api_key"
      ]
    }
  }
}
```

## Server Configuration

Ensure your MCP server is configured to accept API keys from headers:

1. The server automatically extracts API keys from headers
2. Header values take precedence over environment variables
3. Tool arguments take precedence over header values

Priority order: Tool arguments > Headers > Environment variables

## Security Considerations

1. **Use HTTPS**: Always use HTTPS URLs in production to protect API keys in transit
2. **Rotate Keys**: Regularly rotate your Airtable API keys
3. **Minimal Scopes**: Use Airtable Personal Access Tokens with only required scopes
4. **Access Control**: Configure server-side access control to limit accessible bases/tables

## Troubleshooting

### API Key Not Recognized

If you see "No Airtable API key provided" errors:

1. Check header syntax in Claude Desktop config
2. Verify the server is running the latest version with header support
3. Test with curl:

```bash
curl -X POST http://your-server-url:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-Airtable-Api-Key: your_api_key" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Using with Zeabur or Other Platforms

When deploying to platforms like Zeabur:

1. Don't set `AIRTABLE_API_KEY` as an environment variable
2. Pass it via headers from Claude Desktop instead
3. This allows multiple users with different API keys

## Examples

### Basic Setup

```json
{
  "mcpServers": {
    "airtable": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote",
        "https://your-mcp-server.zeabur.app/mcp",
        "--header",
        "X-Airtable-Api-Key: patXXXXXXXXXXXXXXXX"
      ]
    }
  }
}
```

### Multi-Base Setup

For accessing multiple bases with different API keys:

```json
{
  "mcpServers": {
    "airtable-personal": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote",
        "https://mcp-server.example.com/mcp",
        "--header",
        "X-Airtable-Api-Key: patPersonalXXXXXXXX",
        "--header",
        "X-Airtable-Base-Id: appPersonalXXXXXX"
      ]
    },
    "airtable-work": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp/mcp-remote",
        "https://mcp-server.example.com/mcp",
        "--header",
        "X-Airtable-Api-Key: patWorkXXXXXXXXXX",
        "--header",
        "X-Airtable-Base-Id: appWorkXXXXXXXXXX"
      ]
    }
  }
}
```

## Further Reading

- [MCP Remote Documentation](https://github.com/mcp/mcp-remote)
- [Airtable API Documentation](https://airtable.com/developers/web/api/introduction)
- [Claude Desktop Configuration](https://claude.ai/docs/desktop-configuration)