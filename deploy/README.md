# Deployment Guide

This directory contains deployment configurations for various platforms. The MCP Airtable server can be deployed in multiple ways depending on your needs.

## Transport Modes

The MCP server supports two transport modes:

1. **STDIO Mode** - For local Claude Desktop integration
   - Direct process communication
   - Run with: `npm start`
   - Used by: Claude Desktop, local development

2. **HTTP Mode** - For remote deployments
   - RESTful HTTP API
   - Run with: `npm run start:server`
   - Endpoint: `/mcp`
   - Used by: Cloud deployments, remote access

## Directory Structure

```
deploy/
├── base/                 # Shared configuration templates
├── docker/              # Docker deployment files
├── claude-desktop/      # Claude Desktop configuration
└── scripts/             # Deployment utilities
```

## Quick Start

### Local Development (STDIO)

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in STDIO mode
npm start
```

### HTTP Server Deployment

```bash
# Build the project
npm run build

# Run HTTP server
npm run start:server
```

### Docker Deployment

```bash
# Build Docker image
docker build -t mcp-airtable .

# Run container
docker run -p 3000:3000 \
  -e AIRTABLE_API_KEY=your_key \
  -e MCP_AUTH_TOKEN=your_token \
  mcp-airtable
```

## Environment Configuration

### Required Variables
- `AIRTABLE_API_KEY` - Your Airtable API key (optional if using per-request keys)

### Recommended for Production
- `MCP_AUTH_TOKEN` - Bearer token for authentication
- `NODE_ENV=production` - Production environment
- `LOG_LEVEL=info` - Logging level

### Optional Features
- **Storage**: `AWS_S3_BUCKET` or `GCS_BUCKET`
- **Redis**: `REDIS_URL` for rate limiting
- **Access Control**: `ALLOWED_BASES`, `BLOCKED_TABLES`

## Platform-Specific Deployment

### Cloud Platforms

Most cloud platforms support Docker deployments:

- **AWS ECS/Fargate**: Use task definitions
- **Google Cloud Run**: Deploy as container service
- **Azure Container Instances**: Use ARM templates
- **Heroku**: Container registry deployment
- **Railway/Render**: Direct GitHub integration

### Reverse Proxy Setup

For nginx or similar:

```nginx
location /mcp {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Security Best Practices

1. Always use `MCP_AUTH_TOKEN` in production
2. Configure HTTPS/TLS termination
3. Set appropriate CORS origins
4. Enable rate limiting
5. Use secrets management for API keys
6. Implement access control lists
7. Monitor logs and metrics

## Health Monitoring

Check service health:

```bash
curl http://your-server:3000/health
```

## Connecting Claude Desktop

### Using mcp-remote

Configure Claude Desktop to connect to your deployed server:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "connect",
        "https://your-deployed-server.com/mcp"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_auth_token"
      }
    }
  }
}
```

See the [MCP-Remote Setup Guide](../docs/guides/claude-desktop-mcp-remote.md) for detailed configuration options.

## Troubleshooting

Enable debug mode:

```bash
LOG_LEVEL=debug NODE_ENV=development npm run start:server
```

Common issues:
- **401 Unauthorized**: Check MCP_AUTH_TOKEN
- **Connection refused**: Verify PORT and firewall
- **Airtable errors**: Check API key and rate limits
- **CORS errors**: Configure CORS_ORIGIN properly