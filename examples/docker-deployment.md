# Docker Deployment Guide

Deploy MCP Airtable as a remote Streamable HTTP server using Docker.

## Quick Start

```bash
# Build and run
docker build -t mcp-airtable .
docker run -d -p 3000:3000 --name mcp-airtable mcp-airtable

# Verify it's running
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{}},"id":1}'
```

## Using Docker Compose

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `NODE_ENV` | production | Environment mode |
| `LOG_LEVEL` | info | Logging: debug, info, warn, error |
| `AIRTABLE_API_KEY` | - | Default API key (optional) |

### Custom Port

```bash
# Docker run
docker run -d -p 8080:8080 -e PORT=8080 mcp-airtable

# Docker Compose
PORT=8080 docker-compose up -d
```

## Production Deployment

### 1. Build Production Image

```bash
docker build -t mcp-airtable:latest .
docker tag mcp-airtable:latest your-registry.com/mcp-airtable:latest
docker push your-registry.com/mcp-airtable:latest
```

### 2. Deploy with HTTPS (Recommended)

For production, always use HTTPS. Options:

#### Option A: Cloud Provider (Recommended)
Deploy to a cloud platform that handles TLS:
- **Zeabur**: Automatic HTTPS
- **Railway**: Automatic HTTPS
- **Fly.io**: Automatic HTTPS
- **Render**: Automatic HTTPS

#### Option B: Nginx Reverse Proxy

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream mcp {
        server mcp-airtable:3000;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;

        location /mcp {
            proxy_pass http://mcp;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # SSE support for Streamable HTTP
            proxy_set_header Connection '';
            proxy_buffering off;
            proxy_cache off;
            chunked_transfer_encoding off;
        }
    }

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }
}
```

Update `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mcp-airtable:
    build: .
    container_name: mcp-airtable
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: mcp-nginx
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - mcp-airtable
    restart: unless-stopped
```

### 3. Health Checks

The Docker image includes a health check that verifies the MCP endpoint:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' mcp-airtable

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' mcp-airtable
```

## Connecting Clients

### Claude.ai Web

1. Go to [claude.ai](https://claude.ai) → Settings → Connectors
2. Add custom connector: `https://your-domain.com/mcp`
3. Authentication will be handled via headers

### Direct HTTP Client

```bash
# List available tools
curl -X POST https://your-domain.com/mcp \
  -H "Content-Type: application/json" \
  -H "x-airtable-api-key: patXXXXX.XXXXX..." \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Call a tool
curl -X POST https://your-domain.com/mcp \
  -H "Content-Type: application/json" \
  -H "x-airtable-api-key: patXXXXX.XXXXX..." \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"list_bases",
      "arguments":{}
    },
    "id":2
  }'
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs mcp-airtable

# Run interactively
docker run -it --rm mcp-airtable
```

### Health check failing

```bash
# Test endpoint manually
docker exec mcp-airtable node -e "
  const http = require('http');
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/mcp',
    method: 'POST',
    headers: {'Content-Type': 'application/json'}
  }, (res) => {
    console.log('Status:', res.statusCode);
    res.on('data', d => console.log(d.toString()));
  });
  req.write(JSON.stringify({jsonrpc:'2.0',method:'initialize',params:{capabilities:{}},id:1}));
  req.end();
"
```

### Connection refused

- Verify port mapping: `-p 3000:3000`
- Check firewall rules
- Ensure container is running: `docker ps`

## Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 0.25 cores | 1 core |
| Memory | 128 MB | 512 MB |
| Disk | 100 MB | 200 MB |

## Security Notes

- Always use HTTPS in production
- Don't set `AIRTABLE_API_KEY` in environment for multi-tenant use
- Pass API keys via `x-airtable-api-key` header per request
- Consider adding rate limiting at the proxy level
- Use secrets management for sensitive configuration
