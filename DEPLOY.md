# Deployment Guide

## Quick Deploy to Zeabur

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/YOUR_TEMPLATE_ID)

## Manual Deployment

### Prerequisites
- Node.js 18+ 
- Airtable API key with appropriate permissions
- (Optional) Redis instance for high-volume operations
- (Optional) S3 or GCS bucket for file uploads

### Environment Variables

#### Required
- `AIRTABLE_API_KEY` - Your Airtable personal access token
- `MCP_AUTH_TOKEN` - Bearer token for authentication (production only)

#### Optional
- `AIRTABLE_BASE_ID` - Default base ID
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

See [Environment Setup Guide](docs/guides/environment-setup.md) for complete list.

### Deploy to Zeabur

1. Fork this repository
2. Login to [Zeabur Dashboard](https://dash.zeabur.com)
3. Create new project and select your forked repo
4. Set required environment variables
5. Deploy!

See [Zeabur Deployment Guide](docs/guides/zeabur-deployment.md) for detailed instructions.

### Deploy with Docker

```bash
# Build image
docker build -t mcp-airtable .

# Run container
docker run -d \
  -p 3000:3000 \
  -e AIRTABLE_API_KEY=your_key \
  -e MCP_AUTH_TOKEN=your_token \
  mcp-airtable
```

### Deploy to Other Platforms

The service includes:
- Dockerfile for containerized deployments
- Health check endpoint at `/health`
- SSE endpoint at `/mcp` for MCP protocol
- Automatic SSL/TLS support on most platforms

Compatible with:
- Heroku
- Railway
- Fly.io
- Google Cloud Run
- AWS ECS/Fargate
- Any platform supporting Docker

### Post-Deployment

1. Test the health endpoint:
   ```bash
   curl https://your-service.com/health
   ```

2. Update Claude Desktop config to use remote service:
   ```json
   {
     "mcpServers": {
       "airtable-remote": {
         "command": "curl",
         "args": [
           "-N",
           "-H", "Authorization: Bearer YOUR_TOKEN",
           "https://your-service.com/mcp"
         ]
       }
     }
   }
   ```

### Security Checklist

- [ ] Strong MCP_AUTH_TOKEN (32+ characters)
- [ ] HTTPS enabled
- [ ] Environment-specific API keys
- [ ] Regular key rotation schedule
- [ ] Access logs enabled
- [ ] Rate limiting configured