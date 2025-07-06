# n8n Bridge Setup for MCP Airtable

This guide helps you connect Claude Desktop to your Zeabur-deployed MCP Airtable server using n8n as a bridge.

## Why Use n8n?

- Claude Desktop uses stdio transport
- Zeabur deployment uses SSE (Server-Sent Events)
- n8n can bridge between these two protocols

## Setup Instructions

### 1. Import the Workflow

1. Open your n8n instance
2. Go to Workflows → Import
3. Copy and paste the content from `mcp-airtable-sse-bridge.json`
4. Save the workflow

### 2. Configure the Workflow

1. Open the imported workflow
2. Click on the "SSE Webhook" node
3. Note the webhook URL (it will be something like `https://your-n8n.com/webhook/mcp-bridge`)
4. Activate the workflow

### 3. Configure Claude Desktop

Edit your Claude Desktop config file:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "curl",
      "args": [
        "-N",
        "-H", "Authorization: Bearer YOUR_MCP_AUTH_TOKEN",
        "-H", "Accept: text/event-stream",
        "https://your-n8n-instance.com/webhook/mcp-bridge"
      ]
    }
  }
}
```

Replace:
- `YOUR_MCP_AUTH_TOKEN` - The token you set on Zeabur
- `your-n8n-instance.com` - Your n8n instance URL
- `mcp-bridge` - The webhook path from your n8n workflow

### 4. Alternative: Using Environment Variables

If you prefer not to expose tokens in the config:

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "command": "sh",
      "args": [
        "-c",
        "curl -N -H \"Authorization: Bearer $MCP_AUTH_TOKEN\" -H \"Accept: text/event-stream\" https://your-n8n-instance.com/webhook/mcp-bridge"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Testing the Connection

1. Restart Claude Desktop
2. Check if the MCP server appears in the tools list
3. Try a simple command like "list Airtable bases"

## Troubleshooting

### n8n Workflow Not Triggering
- Ensure the workflow is activated
- Check the webhook URL is correct
- Verify n8n instance is accessible

### Authentication Errors
- Verify the MCP_AUTH_TOKEN matches on Zeabur
- Check the Authorization header format: `Bearer YOUR_TOKEN`

### Connection Timeouts
- n8n webhooks have a timeout limit
- For long-running operations, you may need to adjust n8n settings

## Security Notes

1. **Use HTTPS** for your n8n instance
2. **Protect your n8n webhook** with authentication if possible
3. **Keep your MCP_AUTH_TOKEN** secret
4. Consider IP whitelisting on n8n if available

## Direct Zeabur Connection (Without n8n)

Your Zeabur deployment is available at:
- URL: `https://caissa-mcp-airtable.zeabur.app`
- SSE Endpoint: `https://caissa-mcp-airtable.zeabur.app/mcp`
- Health Check: `https://caissa-mcp-airtable.zeabur.app/health`

## Support

For issues with:
- MCP Server: Check Zeabur logs
- n8n Bridge: Check n8n execution logs
- Claude Desktop: Check Claude Desktop developer console