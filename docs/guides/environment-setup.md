# Environment Setup Guide

This guide explains where and how to configure environment variables for the MCP Airtable server.

## Where to Set Environment Variables

Environment variables can be set in different locations depending on how you're running the server:

### 1. Local Development (.env file)

**Location:** `/Users/marchi-lau/Companies/delta-and-beta/projects/mcp-airtable/.env`

Create a `.env` file in the project root directory:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

**Example .env file:**
```bash
# Required
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Optional
NODE_ENV=development
LOG_LEVEL=debug
```

### 2. Claude Desktop Configuration

When using with Claude Desktop, environment variables are set in the Claude Desktop configuration file.

**Location (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Location (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-airtable/dist/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "patXXXXXXXXXXXXXX",
        "AIRTABLE_BASE_ID": "appXXXXXXXXXXXXXX",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 3. System Environment Variables

For production deployments, you can set system-level environment variables:

**Linux/macOS:**
```bash
export AIRTABLE_API_KEY="patXXXXXXXXXXXXXX"
export AIRTABLE_BASE_ID="appXXXXXXXXXXXXXX"
```

**Windows:**
```cmd
set AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
set AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

### 4. Docker Environment

When using Docker, pass environment variables via:

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  mcp-airtable:
    build: .
    environment:
      AIRTABLE_API_KEY: ${AIRTABLE_API_KEY}
      AIRTABLE_BASE_ID: ${AIRTABLE_BASE_ID}
      REDIS_HOST: redis
    env_file:
      - .env
```

**Docker run:**
```bash
docker run -e AIRTABLE_API_KEY=patXXX -e AIRTABLE_BASE_ID=appXXX mcp-airtable
```

### 5. Cloud Deployment (Zeabur, Heroku, etc.)

Set environment variables in the platform's dashboard or CLI:

**Zeabur:**
```bash
zeabur env set AIRTABLE_API_KEY patXXXXXXXXXXXXXX
zeabur env set AIRTABLE_BASE_ID appXXXXXXXXXXXXXX
```

**Heroku:**
```bash
heroku config:set AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
heroku config:set AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

## Environment Variable Priority

Variables are loaded in this order (later overrides earlier):
1. Default values in code
2. `.env` file (via dotenv)
3. System environment variables
4. Command-line arguments (if applicable)

## Required vs Optional Variables

### Required Variables
These must be set for the server to function:

- `AIRTABLE_API_KEY` - Your Airtable personal access token

### Conditionally Required
Required based on usage:

- `AIRTABLE_BASE_ID` - Required if not specifying baseId in each request
- `MCP_AUTH_TOKEN` - Required for remote/production deployments
- `AWS_S3_BUCKET` + credentials - Required for S3 uploads
- `GCS_BUCKET` + credentials - Required for GCS uploads

### Optional Variables
These have sensible defaults:

- `PORT` - Default: 3000
- `NODE_ENV` - Default: production
- `LOG_LEVEL` - Default: info
- `REDIS_*` - Only needed for high-volume operations
- `CORS_ORIGIN` - Default: * (all origins)

## Security Best Practices

### 1. Never Commit .env Files
The `.env` file should never be committed to version control:
```bash
# Verify .env is in .gitignore
grep "\.env" .gitignore
```

### 2. Use Strong Tokens
Generate secure tokens for production:
```bash
# Generate a secure token
openssl rand -base64 32
```

### 3. Limit Access
- Use environment-specific API keys
- Rotate keys regularly
- Set minimum required scopes on Airtable tokens

### 4. Encrypt Sensitive Values
For extra security, encrypt sensitive values:
```bash
# Encrypt a value
echo -n "my-secret" | openssl enc -aes-256-cbc -base64 -pbkdf2
```

## Troubleshooting

### Verify Environment Variables

**Check if variables are loaded:**
```javascript
// Add to your code temporarily
console.log('API Key exists:', !!process.env.AIRTABLE_API_KEY);
console.log('Base ID:', process.env.AIRTABLE_BASE_ID);
```

**List all environment variables:**
```bash
# Linux/macOS
env | grep AIRTABLE

# Windows
set | findstr AIRTABLE
```

### Common Issues

1. **"Airtable API key is required"**
   - Ensure AIRTABLE_API_KEY is set
   - Check for typos in variable name
   - Verify .env file is in project root

2. **Variables not loading from .env**
   - Ensure dotenv is installed: `npm install dotenv`
   - Check file is named `.env` (not `.env.txt`)
   - Restart the server after changes

3. **Permission errors**
   - Check file permissions: `ls -la .env`
   - Ensure the process can read the file

## Example Configurations

### Minimal Development Setup
```bash
# .env
AIRTABLE_API_KEY=pat123456789abcdef
AIRTABLE_BASE_ID=app123456789abcdef
```

### Full Production Setup
```bash
# .env
# Core
AIRTABLE_API_KEY=pat123456789abcdef
AIRTABLE_BASE_ID=app123456789abcdef
NODE_ENV=production
LOG_LEVEL=warn

# Security
MCP_AUTH_TOKEN=very-long-secure-token-here

# S3 Storage
AWS_REGION=us-east-1
AWS_S3_BUCKET=prod-airtable-attachments
AWS_ACCESS_KEY_ID=AKIA123456789ABCDEF
AWS_SECRET_ACCESS_KEY=verylongsecretkey

# Redis (for scaling)
REDIS_URL=redis://default:password@redis.example.com:6379/0
QUEUE_CONCURRENCY=10

# CORS
CORS_ORIGIN=https://app.example.com
```

### Testing Configuration
```bash
# .env.test
AIRTABLE_API_KEY=pat-test-key
AIRTABLE_BASE_ID=app-test-base
NODE_ENV=test
LOG_LEVEL=debug
```