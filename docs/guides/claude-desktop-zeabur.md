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

Claude Desktop currently uses stdio transport, so we need to use a local proxy to connect to the remote SSE server.

#### Option 1: Using npx (Recommended)

Edit the `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sse-client", "https://your-app.zeabur.app/mcp"],
      "env": {
        "AUTHORIZATION": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

#### Option 2: Using the local installation

If you have the MCP server installed locally:

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "node",
      "args": ["/path/to/mcp-airtable/scripts/claude-desktop-proxy.js"],
      "env": {
        "MCP_SERVER_URL": "https://your-app.zeabur.app/mcp",
        "MCP_AUTH_TOKEN": "YOUR_MCP_AUTH_TOKEN",
        "AIRTABLE_API_KEY": "your-airtable-api-key",
        "AIRTABLE_BASE_ID": "your-default-base-id"
      }
    }
  }
}
```

### 3. Configuration Options

#### For Option 1 (npx with SSE client)

- `command`: Always `"npx"`
- `args`: `["-y", "@modelcontextprotocol/server-sse-client", "YOUR_ZEABUR_URL/mcp"]`
- `env.AUTHORIZATION`: Full authorization header including "Bearer " prefix

#### For Option 2 (local proxy)

- `MCP_SERVER_URL`: Your Zeabur deployment URL with `/mcp` endpoint
- `MCP_AUTH_TOKEN`: Just the token value (without "Bearer " prefix)
- `AIRTABLE_API_KEY`: Your Airtable personal access token
- `AIRTABLE_BASE_ID`: Optional default base ID

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
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sse-client", "https://mcp-airtable-prod.zeabur.app/mcp"],
      "env": {
        "AUTHORIZATION": "Bearer your-secret-token-here"
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