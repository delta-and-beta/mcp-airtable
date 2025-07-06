# Zeabur Deployment Guide

This guide walks you through deploying the MCP Airtable server to Zeabur.

## Prerequisites

1. A [Zeabur](https://zeabur.com) account
2. [Zeabur CLI](https://docs.zeabur.com/cli/get-started) installed (optional)
3. Your Airtable API key

## Deployment Steps

### 1. Using Zeabur Dashboard (Recommended)

1. **Login to Zeabur Dashboard**
   - Go to https://dash.zeabur.com
   - Create a new project

2. **Deploy from GitHub**
   - Click "Deploy Service"
   - Select "Git"
   - Connect your GitHub account if not already connected
   - Select your forked repository
   - Choose the branch to deploy

3. **Configure Environment Variables**
   
   Zeabur will automatically detect the required variables from `zeabur.json`. Set these in the dashboard:

   **Required:**
   - `AIRTABLE_API_KEY`: Your Airtable personal access token
   - `MCP_AUTH_TOKEN`: A secure bearer token for authentication

   **Optional:**
   - `AIRTABLE_BASE_ID`: Default base ID (if you want a default)
   - `PORT`: Default is 3000
   - `NODE_ENV`: Default is production

4. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete
   - Your service will be available at `https://your-service.zeabur.app`

### 2. Using Zeabur CLI

```bash
# Login to Zeabur
zeabur auth login

# Create a new project
zeabur project create mcp-airtable

# Deploy the service
zeabur deploy

# Set environment variables
zeabur env set AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
zeabur env set MCP_AUTH_TOKEN=your-secure-token-here
zeabur env set AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Check deployment status
zeabur service list
```

## Environment Variables

### Core Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AIRTABLE_API_KEY` | ✅ Yes | Airtable personal access token | `patXXXXXXXXXXXXXX` |
| `MCP_AUTH_TOKEN` | ✅ Yes | Bearer token for API authentication | `sk-proj-xxxxx` |
| `AIRTABLE_BASE_ID` | No | Default base ID | `appXXXXXXXXXXXXXX` |
| `NODE_ENV` | No | Environment mode | `production` |
| `LOG_LEVEL` | No | Logging verbosity | `info` |

### Storage Configuration (Optional)

For file uploads, configure either S3 or GCS:

**AWS S3:**
- `AWS_S3_BUCKET`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_PUBLIC_URL_PREFIX`

**Google Cloud Storage:**
- `GCS_BUCKET`
- `GCS_PROJECT_ID`
- `GCS_CLIENT_EMAIL`
- `GCS_PRIVATE_KEY`
- `GCS_PUBLIC_URL_PREFIX`

### Redis Configuration (Optional)

For high-volume batch operations:
- `REDIS_URL` or (`REDIS_HOST` + `REDIS_PORT` + `REDIS_PASSWORD`)
- `QUEUE_CONCURRENCY`

## Using the Deployed Service

### 1. Update Claude Desktop Configuration

Update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "airtable-remote": {
      "command": "curl",
      "args": [
        "-N",
        "-H", "Authorization: Bearer YOUR_MCP_AUTH_TOKEN",
        "https://your-service.zeabur.app/mcp"
      ]
    }
  }
}
```

### 2. Direct API Usage

Test the deployment:

```bash
# Health check
curl https://your-service.zeabur.app/health

# Test SSE connection
curl -N -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-service.zeabur.app/mcp
```

### 3. Example API Call

```bash
curl -X POST https://your-service.zeabur.app/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }'
```

## Security Considerations

1. **Strong MCP_AUTH_TOKEN**
   - Use a cryptographically secure token
   - At least 32 characters
   - Example: `openssl rand -base64 32`

2. **HTTPS Only**
   - Zeabur provides automatic SSL
   - Never send tokens over HTTP

3. **Environment-Specific Keys**
   - Use different API keys for production
   - Rotate keys regularly

4. **IP Whitelisting**
   - Consider restricting access by IP if possible

## Monitoring and Logs

### View Logs

```bash
# Using CLI
zeabur logs -f

# Or in dashboard
# Navigate to your service > Logs tab
```

### Health Monitoring

The `/health` endpoint provides:
- Service status
- Airtable connectivity
- Storage configuration status

```json
{
  "status": "ok",
  "service": "mcp-airtable",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "airtable": { "status": "ok" },
    "s3": { "status": "not_configured" }
  }
}
```

## Troubleshooting

### Common Issues

1. **"AIRTABLE_API_KEY: Required" error**
   - Ensure the environment variable is set in Zeabur
   - Check for typos in variable name
   - Restart the service after setting

2. **Authentication failures**
   - Verify MCP_AUTH_TOKEN matches in both Zeabur and client
   - Check Authorization header format: `Bearer TOKEN`

3. **Connection timeouts**
   - Check if service is running: `zeabur service list`
   - Verify the service URL is correct
   - Check Zeabur logs for errors

### Debug Mode

Enable debug logging:
```bash
zeabur env set LOG_LEVEL=debug
zeabur env set NODE_ENV=development
```

## Scaling

### Horizontal Scaling

Zeabur supports auto-scaling. Configure in dashboard:
- Min instances: 1
- Max instances: Based on your needs
- CPU threshold: 70%
- Memory threshold: 80%

### Redis for Queue Management

For high-volume operations:
1. Deploy Redis on Zeabur
2. Set `REDIS_URL` in your service
3. Increase `QUEUE_CONCURRENCY` as needed

## Cost Optimization

1. **Use appropriate instance size**
   - Start with smallest instance
   - Monitor usage and scale as needed

2. **Enable auto-sleep**
   - Service sleeps when not in use
   - Wakes up on request

3. **Optimize storage**
   - Use CDN for attachments
   - Clean up old files regularly

## Updates and Maintenance

### Updating the Service

```bash
# Pull latest changes
git pull origin main

# Push to trigger redeploy
git push

# Or manually trigger in dashboard
```

### Zero-Downtime Updates

Zeabur handles rolling updates automatically:
1. New instance is created
2. Health checks pass
3. Traffic switches to new instance
4. Old instance is terminated

## Support

- Zeabur Documentation: https://docs.zeabur.com
- MCP Airtable Issues: https://github.com/your-username/mcp-airtable/issues
- Zeabur Discord: https://discord.gg/zeabur