# Configuration Guide

This guide covers all configuration options for the MCP Airtable server, including environment variables, Claude Desktop setup, and advanced configurations.

## Environment Variables

### Core Configuration

#### `AIRTABLE_API_KEY` (Required)
Your Airtable personal access token or API key.

```bash
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
```

**How to obtain:**
1. Go to [Airtable Account](https://airtable.com/account)
2. Navigate to "Personal access tokens"
3. Create a new token with required scopes
4. Copy the token (starts with `pat`)

**Required scopes:**
- `data.records:read` - Read records
- `data.records:write` - Create/update/delete records
- `schema.bases:read` - List bases and tables

#### `AIRTABLE_BASE_ID` (Optional)
Default base ID to use when not specified in tool calls.

```bash
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

**How to find:**
1. Open your Airtable base
2. Check the URL: `https://airtable.com/appXXXXXXXXXXXXXX/...`
3. The part starting with `app` is your base ID

### Server Configuration

#### `PORT` (Optional)
Port for the HTTP server (SSE transport only).

```bash
PORT=3000  # Default: 3000
```

#### `NODE_ENV` (Optional)
Environment mode affecting logging and error details.

```bash
NODE_ENV=production  # Options: development, production, test
```

**Effects:**
- `production`: Minimal logs, secure error messages
- `development`: Verbose logs, detailed errors
- `test`: Test-specific behaviors

#### `MCP_AUTH_TOKEN` (Required for remote)
Bearer token for authenticating MCP connections.

```bash
MCP_AUTH_TOKEN=your-very-secure-token-here
```

**Token requirements:**
- Minimum 32 characters recommended
- Use cryptographically secure random generation
- Different tokens for each environment

### S3 Configuration (Optional)

Required only if using the `upload_attachment` tool.

#### `AWS_S3_BUCKET` (Required for S3)
S3 bucket name for storing attachments.

```bash
AWS_S3_BUCKET=my-airtable-attachments
```

#### `AWS_REGION` (Optional)
AWS region for S3 operations.

```bash
AWS_REGION=us-east-1  # Default: us-east-1
```

#### `AWS_ACCESS_KEY_ID` (Required for S3)
AWS access key with S3 permissions.

```bash
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
```

#### `AWS_SECRET_ACCESS_KEY` (Required for S3)
AWS secret key corresponding to the access key.

```bash
AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

#### `AWS_S3_PUBLIC_URL_PREFIX` (Optional)
Custom URL prefix for S3 files (e.g., CloudFront).

```bash
AWS_S3_PUBLIC_URL_PREFIX=https://cdn.example.com
```

### Redis Configuration (Optional)

Redis enables distributed queue processing for high-volume batch operations.

#### `REDIS_URL` (Optional)
Full Redis connection URL (overrides individual settings).

```bash
REDIS_URL=redis://username:password@localhost:6379/0
```

#### `REDIS_HOST` (Optional)
Redis server hostname.

```bash
REDIS_HOST=localhost  # Default: localhost
```

#### `REDIS_PORT` (Optional)
Redis server port.

```bash
REDIS_PORT=6379  # Default: 6379
```

#### `REDIS_PASSWORD` (Optional)
Redis authentication password.

```bash
REDIS_PASSWORD=your-redis-password
```

#### `QUEUE_CONCURRENCY` (Optional)
Number of concurrent queue workers.

```bash
QUEUE_CONCURRENCY=5  # Default: 5
```

**Benefits of Redis:**
- Distributed processing across multiple instances
- Persistent queue survives server restarts
- Better handling of rate limits
- Automatic retry with exponential backoff

**Without Redis:**
- In-memory queue (lost on restart)
- Single instance processing
- Still respects rate limits
- Basic retry logic

### Google Cloud Storage Configuration (Optional)

Required only if using the `upload_attachment` tool with GCS.

#### `GCS_BUCKET` (Required for GCS)
Google Cloud Storage bucket name for storing attachments.

```bash
GCS_BUCKET=my-airtable-attachments
```

#### `GCS_PROJECT_ID` (Optional)
Google Cloud project ID.

```bash
GCS_PROJECT_ID=my-project-123456
```

#### Authentication Options

**Option 1: Service Account Key File**

#### `GCS_KEY_FILE` (Optional)
Path to service account JSON key file.

```bash
GCS_KEY_FILE=/path/to/service-account-key.json
```

**Option 2: Service Account Credentials**

#### `GCS_CLIENT_EMAIL` (Required if not using key file)
Service account email address.

```bash
GCS_CLIENT_EMAIL=my-service-account@my-project.iam.gserviceaccount.com
```

#### `GCS_PRIVATE_KEY` (Required if not using key file)
Service account private key (include \n for line breaks).

```bash
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----"
```

#### `GCS_PUBLIC_URL_PREFIX` (Optional)
Custom public URL prefix for GCS objects (for CDN usage).

```bash
GCS_PUBLIC_URL_PREFIX=https://cdn.example.com/attachments
```

**Storage Selection:**
- If both S3 and GCS are configured, use `storage` parameter to specify
- Default behavior (`auto`): Tries S3 first, then GCS
- Force specific storage: Set `storage` to `s3` or `gcs`

### Advanced Configuration

#### `CORS_ORIGIN` (Optional)
Allowed origins for CORS (SSE transport).

```bash
CORS_ORIGIN=https://app.example.com,https://app2.example.com
```

#### `LOG_LEVEL` (Optional)
Minimum log level to output.

```bash
LOG_LEVEL=info  # Options: debug, info, warn, error
```

## Claude Desktop Configuration

### Local MCP Server

For local stdio transport:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-airtable/dist/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX",
        "AIRTABLE_BASE_ID": "appXXXXXXXXXXXXXX",
        "AWS_S3_BUCKET": "my-bucket",
        "AWS_ACCESS_KEY_ID": "AKIAXXXXXXXXXXXXXXXX",
        "AWS_SECRET_ACCESS_KEY": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "REDIS_PASSWORD": "your-redis-password",
        "QUEUE_CONCURRENCY": "5"
      }
    }
  }
}
```

### Remote MCP Server

For SSE transport (deployed on Zeabur, etc.):

```json
{
  "mcpServers": {
    "airtable-remote": {
      "transport": "sse",
      "url": "https://mcp-airtable.example.com/mcp",
      "headers": {
        "Authorization": "Bearer your-secure-token-here"
      }
    }
  }
}
```

### Multiple Configurations

You can have multiple MCP servers for different bases:

```json
{
  "mcpServers": {
    "airtable-sales": {
      "command": "node",
      "args": ["/path/to/mcp-airtable/dist/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX",
        "AIRTABLE_BASE_ID": "appSalesXXXXXXXXX"
      }
    },
    "airtable-marketing": {
      "command": "node",
      "args": ["/path/to/mcp-airtable/dist/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX",
        "AIRTABLE_BASE_ID": "appMarketingXXXXX"
      }
    }
  }
}
```

## Configuration Files

### `.env` File

Create a `.env` file in the project root:

```env
# Airtable Configuration
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Server Configuration
PORT=3000
NODE_ENV=production
MCP_AUTH_TOKEN=your-secure-token-here

# AWS S3 Configuration (Optional)
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-airtable-attachments
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Optional
AWS_S3_PUBLIC_URL_PREFIX=https://cdn.example.com
CORS_ORIGIN=https://app.example.com
LOG_LEVEL=info
```

### Docker Environment

For Docker deployments, use a `.env.docker` file:

```env
# Production settings
NODE_ENV=production
PORT=3000

# Secrets (use Docker secrets in production)
AIRTABLE_API_KEY=${AIRTABLE_API_KEY}
MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}

# AWS (if needed)
AWS_DEFAULT_REGION=us-east-1
```

## S3 Bucket Configuration

### Bucket Setup

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://my-airtable-attachments
   ```

2. **Configure Public Access** (if needed)
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::my-airtable-attachments/*"
       }
     ]
   }
   ```

3. **CORS Configuration**
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

### IAM Permissions

Create an IAM user with minimal permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::my-airtable-attachments/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::my-airtable-attachments"
    }
  ]
}
```

## Rate Limiting Configuration

### Default Limits

The server enforces Airtable's rate limits:
- 5 requests per second per base
- Automatic queuing and retry

### Custom Rate Limits

Future versions will support custom rate limiting:

```env
# Future configuration options
RATE_LIMIT_REQUESTS=5
RATE_LIMIT_WINDOW=1000
RATE_LIMIT_PER_CLIENT=100
RATE_LIMIT_PER_CLIENT_WINDOW=60000
```

## Monitoring Configuration

### Health Check

The health endpoint provides system status:

```bash
curl https://your-server/health
```

Response:
```json
{
  "status": "ok",
  "service": "mcp-airtable",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "checks": {
    "airtable": { "status": "ok" },
    "s3": { "status": "ok" }
  }
}
```

### Logging Configuration

Control log output:

```env
# Structured JSON logs
LOG_FORMAT=json

# Log to file
LOG_FILE=/var/log/mcp-airtable.log

# Log rotation
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
```

## Troubleshooting Configuration

### Debug Mode

Enable verbose logging:

```env
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=mcp:*
```

### Test Configuration

Test your configuration:

```bash
# Validate environment
npm run validate-config

# Test Airtable connection
npm run test:airtable

# Test S3 connection
npm run test:s3
```

### Common Issues

1. **"Airtable API key is required"**
   - Check spelling: `AIRTABLE_API_KEY` (not `AIRTABLE_KEY`)
   - Ensure no quotes around the value in .env
   - Verify the key starts with `pat`

2. **"Invalid base ID format"**
   - Base IDs must match: `app[a-zA-Z0-9]{14}`
   - Check for extra spaces or characters

3. **S3 upload fails**
   - Verify all AWS variables are set
   - Check IAM permissions
   - Ensure bucket exists

4. **Authentication failures**
   - Match `MCP_AUTH_TOKEN` exactly
   - Include "Bearer " prefix in header
   - Check for trailing spaces

## Best Practices

1. **Use Environment-Specific Files**
   - `.env.development`
   - `.env.production`
   - `.env.test`

2. **Never Commit Secrets**
   - Add `.env*` to `.gitignore`
   - Use secret management services

3. **Validate on Startup**
   - The server validates configuration
   - Fails fast with clear errors

4. **Rotate Credentials**
   - Change API keys periodically
   - Update tokens quarterly
   - Monitor for unauthorized usage

5. **Use Least Privilege**
   - Minimal Airtable scopes
   - Restricted S3 permissions
   - Limited network access