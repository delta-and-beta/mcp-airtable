# Claude Desktop MCP-Remote Setup Guide

This guide covers how to connect Claude Desktop to a remote MCP Airtable server using mcp-remote.

## Overview

MCP-remote allows Claude Desktop to connect to MCP servers running on remote hosts via HTTP/HTTPS. This is ideal for:
- Production deployments
- Team shared servers
- Cloud-hosted instances
- Multi-user environments

## Installation

### 1. Server Setup

First, ensure your MCP Airtable server is running in HTTP mode:

```bash
# Using npm
npm run start:server

# Or directly
node dist/server.js

# With custom port
PORT=8080 node dist/server.js
```

### 2. Claude Desktop Configuration

Add the remote server to your Claude Desktop config:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "connect",
        "https://your-server.com/mcp"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_auth_token_here"
      }
    }
  }
}
```

## Authentication Options

### Option 1: Server-Level Authentication (MCP_AUTH_TOKEN)

This authenticates your connection to the MCP server:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "https://api.example.com/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "server_auth_token_123"
      }
    }
  }
}
```

The server validates this token for all requests.

### Option 2: Airtable API Key in Environment

Provide the Airtable API key that the server will use:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "https://api.example.com/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "server_auth_token_123",
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX"
      }
    }
  }
}
```

**Note**: Environment variables in Claude Desktop config are NOT sent to the remote server. They're only available to the mcp-remote process.

### Option 3: Per-Request API Keys (Recommended)

Configure without Airtable credentials and provide them per-request:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "https://api.example.com/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "server_auth_token_123"
      }
    }
  }
}
```

Then in Claude:
```
"Using API key patXXXXXXXXXXXXXX and base appYYYYYYYYYYYYYY, list all tables"
```

## Server Configuration

### Basic HTTP Server

```bash
# .env file
NODE_ENV=production
PORT=3000
MCP_AUTH_TOKEN=your_secure_token_here
CORS_ORIGIN=*  # Configure appropriately for production
```

### With Fixed Airtable API Key

```bash
# .env file
NODE_ENV=production
PORT=3000
MCP_AUTH_TOKEN=your_secure_token_here
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appYYYYYYYYYYYYYY
```

### For Per-Request API Keys

```bash
# .env file
NODE_ENV=production
PORT=3000
MCP_AUTH_TOKEN=your_secure_token_here
# No AIRTABLE_API_KEY - will be provided per-request
```

## Advanced Configurations

### Custom Headers

If your server requires additional headers:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "https://api.example.com/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "your_token",
        "MCP_REMOTE_HEADERS": "{\"X-Custom-Header\": \"value\", \"X-API-Version\": \"2\"}"
      }
    }
  }
}
```

### Using a Proxy

For corporate environments with proxy requirements:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "https://api.example.com/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "your_token",
        "HTTP_PROXY": "http://proxy.company.com:8080",
        "HTTPS_PROXY": "http://proxy.company.com:8080"
      }
    }
  }
}
```

### Timeout Configuration

For slow networks or large operations:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "https://api.example.com/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "your_token",
        "MCP_REMOTE_TIMEOUT": "30000"  // 30 seconds
      }
    }
  }
}
```

## Multi-Environment Setup

### Development Server

```json
{
  "mcpServers": {
    "airtable-dev": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "http://localhost:3000/mcp"],
      "env": {
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"  // Only for local dev with self-signed certs
      }
    }
  }
}
```

### Staging Server

```json
{
  "mcpServers": {
    "airtable-staging": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "https://staging.example.com/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "staging_token_here"
      }
    }
  }
}
```

### Production Server

```json
{
  "mcpServers": {
    "airtable-prod": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "connect", "https://api.example.com/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "prod_token_here"
      }
    }
  }
}
```

## Troubleshooting

### Connection Issues

1. **Test server health**:
```bash
curl https://your-server.com/health
```

2. **Test with auth token**:
```bash
curl -H "Authorization: Bearer your_token" https://your-server.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "initialize", "id": 1}'
```

3. **Enable debug logging**:
```json
{
  "env": {
    "MCP_AUTH_TOKEN": "your_token",
    "DEBUG": "mcp-remote:*"
  }
}
```

### Common Errors

#### 401 Unauthorized
- Check MCP_AUTH_TOKEN matches server configuration
- Ensure token is being sent correctly

#### Connection Refused
- Verify server is running
- Check firewall rules
- Confirm correct port

#### CORS Errors
- Configure CORS_ORIGIN on server
- Check if browser is blocking requests

#### SSL/TLS Errors
- Ensure valid certificates in production
- For local dev, use NODE_TLS_REJECT_UNAUTHORIZED=0

### Performance Tips

1. **Use connection pooling**: mcp-remote reuses connections automatically

2. **Configure appropriate timeouts**: Balance between reliability and responsiveness

3. **Enable compression**: Most servers support gzip automatically

4. **Monitor server health**: Set up monitoring for your MCP server

## Security Best Practices

1. **Use HTTPS in production**: Never send tokens over unencrypted connections

2. **Rotate tokens regularly**: Change MCP_AUTH_TOKEN periodically

3. **Limit CORS origins**: Don't use `*` in production

4. **Use per-request API keys**: Avoid storing Airtable keys on the server

5. **Enable rate limiting**: Protect against abuse

6. **Monitor access logs**: Track usage patterns

## Example: Complete Production Setup

### Server Configuration (.env)
```bash
NODE_ENV=production
PORT=3000
MCP_AUTH_TOKEN=prod_mcp_token_2024_q1
CORS_ORIGIN=https://claude.ai
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
LOG_LEVEL=info
# No AIRTABLE_API_KEY - using per-request keys
```

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "airtable-production": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "connect",
        "https://mcp.company.com/airtable"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "prod_mcp_token_2024_q1"
      }
    }
  }
}
```

### Usage in Claude
```
"I need to work with our customer database:
- Airtable API Key: patPRODUCTIONKEY123
- Base ID: appCUSTOMERBASE

Please show me all customers added this week."
```

## Next Steps

- [Deploy to Cloud Providers](../deploy/README.md)
- [Configure Access Control](./access-control.md)
- [Set Up Monitoring](./monitoring.md)