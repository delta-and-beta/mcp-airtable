# Deployment Guide

This guide covers various deployment options for the MCP Airtable server, from local development to production cloud deployments.

## Deployment Options

1. [Local Deployment](#local-deployment) - Best for development and personal use
2. [Zeabur Deployment](#zeabur-deployment) - Recommended for production
3. [Docker Deployment](#docker-deployment) - For containerized environments
4. [Other Cloud Platforms](#other-cloud-platforms) - AWS, GCP, Azure

## Local Deployment

### Prerequisites
- Node.js 20+ installed
- npm or yarn
- Airtable API key

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/mcp-airtable.git
   cd mcp-airtable
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Configure Claude Desktop**
   
   Edit your Claude Desktop config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "airtable": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-airtable/dist/index.js"],
         "env": {
           "AIRTABLE_API_KEY": "your-api-key",
           "AIRTABLE_BASE_ID": "appXXXXXXXXXXXXXX"
         }
       }
     }
   }
   ```

6. **Restart Claude Desktop**

## Zeabur Deployment

### Prerequisites
- Zeabur account
- GitHub account
- Airtable API key

### Steps

1. **Fork the repository**
   - Fork this repository to your GitHub account

2. **Connect to Zeabur**
   - Log in to [Zeabur](https://zeabur.com)
   - Connect your GitHub account

3. **Create new service**
   - Click "Create Service"
   - Select your forked repository
   - Zeabur will auto-detect the Dockerfile

4. **Configure environment variables**
   
   In Zeabur dashboard, add these environment variables:
   
   ```env
   # Required
   MCP_AUTH_TOKEN=your-secret-token-here
   AIRTABLE_API_KEY=your-airtable-api-key
   
   # Optional
   AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
   NODE_ENV=production
   
   # For S3 attachments (optional)
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Note your service URL (e.g., `https://your-app.zeabur.app`)

6. **Configure Claude Desktop for remote MCP**
   
   ```json
   {
     "mcpServers": {
       "airtable-remote": {
         "transport": "sse",
         "url": "https://your-app.zeabur.app/mcp",
         "headers": {
           "Authorization": "Bearer your-secret-token-here"
         }
       }
     }
   }
   ```

### Security Considerations

- **Always use HTTPS** in production
- **Set a strong MCP_AUTH_TOKEN**
- **Enable Zeabur's DDoS protection**
- **Monitor usage and logs**

## Docker Deployment

### Local Docker

1. **Build the image**
   ```bash
   docker build -t mcp-airtable .
   ```

2. **Run the container**
   ```bash
   docker run -d \
     -p 3000:3000 \
     -e MCP_AUTH_TOKEN=your-secret-token \
     -e AIRTABLE_API_KEY=your-api-key \
     -e AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX \
     --name mcp-airtable \
     mcp-airtable
   ```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mcp-airtable:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}
      - AIRTABLE_API_KEY=${AIRTABLE_API_KEY}
      - AIRTABLE_BASE_ID=${AIRTABLE_BASE_ID}
      - NODE_ENV=production
      - AWS_REGION=${AWS_REGION}
      - AWS_S3_BUCKET=${AWS_S3_BUCKET}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Run with:
```bash
docker-compose up -d
```

## Other Cloud Platforms

### AWS ECS/Fargate

1. **Build and push to ECR**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URI
   docker build -t mcp-airtable .
   docker tag mcp-airtable:latest $ECR_URI/mcp-airtable:latest
   docker push $ECR_URI/mcp-airtable:latest
   ```

2. **Create task definition** with environment variables

3. **Create service** with ALB for HTTPS

### Google Cloud Run

1. **Build and push to GCR**
   ```bash
   gcloud builds submit --tag gcr.io/$PROJECT_ID/mcp-airtable
   ```

2. **Deploy**
   ```bash
   gcloud run deploy mcp-airtable \
     --image gcr.io/$PROJECT_ID/mcp-airtable \
     --platform managed \
     --region us-central1 \
     --set-env-vars MCP_AUTH_TOKEN=$TOKEN,AIRTABLE_API_KEY=$API_KEY
   ```

### Heroku

1. **Create app**
   ```bash
   heroku create your-mcp-airtable
   ```

2. **Set buildpack**
   ```bash
   heroku buildpacks:set heroku/nodejs
   ```

3. **Configure environment**
   ```bash
   heroku config:set MCP_AUTH_TOKEN=your-token
   heroku config:set AIRTABLE_API_KEY=your-api-key
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

## Production Checklist

Before deploying to production, ensure:

### Security
- [ ] Strong `MCP_AUTH_TOKEN` set
- [ ] HTTPS enabled
- [ ] API keys secured in environment variables
- [ ] CORS configured appropriately
- [ ] Rate limiting enabled

### Configuration
- [ ] `NODE_ENV=production`
- [ ] All required environment variables set
- [ ] Health check endpoint accessible
- [ ] Logging configured

### Monitoring
- [ ] Application logs accessible
- [ ] Error tracking enabled
- [ ] Performance monitoring set up
- [ ] Alerts configured

### Testing
- [ ] All tools tested in staging
- [ ] Authentication verified
- [ ] Error handling tested
- [ ] Rate limiting verified

## Troubleshooting Deployment

### Common Issues

1. **"Airtable API key is required" error**
   - Ensure `AIRTABLE_API_KEY` is set in environment
   - Check for typos in variable name
   - Verify the key is valid

2. **Authentication failures**
   - Verify `MCP_AUTH_TOKEN` matches in both server and client
   - Check Authorization header format: `Bearer <token>`
   - Ensure no extra spaces or characters

3. **Connection timeouts**
   - Check firewall rules
   - Verify service is running on correct port
   - Test health endpoint: `curl https://your-app/health`

4. **S3 upload failures**
   - Verify all AWS credentials are set
   - Check S3 bucket permissions
   - Ensure bucket exists and is accessible

### Debug Mode

For troubleshooting, run with debug logging:

```bash
NODE_ENV=development npm run dev:sse
```

This provides:
- Detailed error messages
- Request/response logging
- Stack traces

## Scaling Considerations

### Horizontal Scaling

The SSE transport is stateless, allowing horizontal scaling:

1. Deploy multiple instances
2. Use a load balancer
3. Configure sticky sessions for SSE connections

### Performance Optimization

1. **Enable caching** (future feature)
2. **Use CDN** for static assets
3. **Optimize container size**
4. **Set appropriate resource limits**

### Monitoring

Recommended monitoring setup:
- Application Performance Monitoring (APM)
- Log aggregation (e.g., ELK stack)
- Uptime monitoring
- Custom metrics for API usage