# Connecting Claude Desktop to Zeabur-Deployed MCP Server

This guide explains how to configure Claude Desktop to connect to your MCP Airtable server deployed on Zeabur.

## Prerequisites

1. Your MCP Airtable server is successfully deployed on Zeabur
2. You have the Zeabur deployment URL (e.g., `https://your-app.zeabur.app`)
3. Claude Desktop is installed on your machine
4. You have your Airtable API key and other required credentials

## Configuration Steps

### 1. Locate Claude Desktop Configuration

Claude Desktop configuration is typically located at:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Configure MCP Server Connection

Edit the `claude_desktop_config.json` file and add your MCP server configuration:

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "transport": {
        "type": "sse",
        "url": "https://your-app.zeabur.app/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
        }
      },
      "env": {
        "AIRTABLE_API_KEY": "your-airtable-api-key",
        "AIRTABLE_BASE_ID": "your-default-base-id"
      }
    }
  }
}
```

### 3. Configuration Options

#### Required Environment Variables

- `AIRTABLE_API_KEY`: Your Airtable personal access token or API key

#### Optional Environment Variables

- `AIRTABLE_BASE_ID`: Default base ID to use if not specified in tool calls
- `MCP_AUTH_TOKEN`: Bearer token for authenticating with the MCP server (recommended for production)

#### Transport Configuration

- `type`: Must be `"sse"` for Server-Sent Events transport
- `url`: Your Zeabur deployment URL with `/mcp` endpoint
- `headers`: Include authorization header if MCP_AUTH_TOKEN is configured on server

### 4. Security Considerations

1. **Use Authentication**: Always configure `MCP_AUTH_TOKEN` on your Zeabur deployment and include it in the Claude Desktop configuration
2. **HTTPS Only**: Zeabur provides HTTPS by default - always use HTTPS URLs
3. **Credential Storage**: Store sensitive credentials in environment variables on Zeabur, not in your code

### 5. Verify Connection

1. Restart Claude Desktop after updating the configuration
2. In Claude Desktop, you should see the MCP server listed in the available tools
3. Try a simple command like listing Airtable bases to verify the connection

### Example Full Configuration

Here's a complete example with multiple MCP servers:

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "transport": {
        "type": "sse",
        "url": "https://mcp-airtable-prod.zeabur.app/mcp",
        "headers": {
          "Authorization": "Bearer your-secret-token-here"
        }
      },
      "env": {
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX",
        "AIRTABLE_BASE_ID": "appXXXXXXXXXXXXXX"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/your-username/Documents"]
    }
  }
}
```

## Troubleshooting

### Connection Issues

1. **Check Server Health**: Visit `https://your-app.zeabur.app/health` to verify the server is running
2. **Verify URL**: Ensure you're using the correct Zeabur deployment URL
3. **Check Logs**: View Zeabur logs for any error messages
4. **Token Mismatch**: Ensure the MCP_AUTH_TOKEN in Claude Desktop matches the one configured on Zeabur

### Common Errors

- **401 Unauthorized**: Check your authorization token
- **404 Not Found**: Verify the `/mcp` endpoint path
- **Connection Refused**: Ensure the server is running and accessible

### Debug Mode

To enable debug logging in Claude Desktop:

1. Set the `CLAUDE_DEBUG` environment variable before starting Claude Desktop
2. Check the console output for detailed connection information

## Additional Resources

- [Zeabur Deployment Guide](./zeabur-deployment.md)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [Airtable API Documentation](https://airtable.com/developers/web/api/introduction)