# MCP Authentication Token Setup Guide

The `MCP_AUTH_TOKEN` is a security token that protects your MCP server from unauthorized access. This guide explains how to generate and configure it.

## What is MCP_AUTH_TOKEN?

- A secret token that acts like a password for your MCP server
- Prevents unauthorized access to your Airtable data through the MCP server
- Should be kept secret and never shared publicly

## Generating a Secure Token

### Method 1: Using the Provided Script

```bash
# Run the token generator script
node scripts/generate-token.js
```

This will output several secure token options to choose from.

### Method 2: Using Command Line

**On macOS/Linux:**
```bash
# Generate a 32-byte random token
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**On Windows (PowerShell):**
```powershell
# Generate a random token
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Method 3: Online Generators

You can use online random string generators, but ensure:
- Use a reputable site
- Generate at least 32 characters
- Use only alphanumeric characters and symbols like `-_`

## Setting up MCP_AUTH_TOKEN on Zeabur

### Step 1: Access Zeabur Dashboard

1. Log in to your [Zeabur Dashboard](https://zeabur.com)
2. Navigate to your MCP Airtable project
3. Click on the "Environment Variables" tab

### Step 2: Add the Token

1. Click "Add Variable"
2. Set the following:
   - **Name**: `MCP_AUTH_TOKEN`
   - **Value**: Your generated token (e.g., `xKj3n_9mP2qR5sT7uV8wX0yZ1aB4cD6e`)
3. Click "Save"

### Step 3: Verify Deployment

After adding the environment variable:
1. Zeabur will automatically redeploy your service
2. Check the deployment logs to ensure it started successfully
3. Visit `https://your-app.zeabur.app/health` - it should return a health check response

## Configuring Claude Desktop

Once your token is set on Zeabur, update your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "mcp-airtable": {
      "transport": {
        "type": "sse",
        "url": "https://your-app.zeabur.app/mcp",
        "headers": {
          "Authorization": "Bearer xKj3n_9mP2qR5sT7uV8wX0yZ1aB4cD6e"
        }
      }
    }
  }
}
```

**Important**: Use the exact same token value in both places!

## Security Best Practices

### DO:
- ✅ Generate a unique token for each deployment
- ✅ Use tokens that are at least 32 characters long
- ✅ Rotate tokens periodically (every 90 days recommended)
- ✅ Use different tokens for different environments (dev, staging, prod)

### DON'T:
- ❌ Use simple passwords like "password123" or "admin"
- ❌ Share your token in public repositories
- ❌ Use the same token across multiple services
- ❌ Include the token in error messages or logs

## Token Rotation

To rotate your token:

1. Generate a new token
2. Update it on Zeabur first
3. Wait for redeployment to complete
4. Update your Claude Desktop configuration
5. Test the connection
6. Remove the old token from any saved configurations

## Troubleshooting

### "401 Unauthorized" Error

This means the token is missing or incorrect:
1. Verify the token on Zeabur matches your Claude Desktop config exactly
2. Ensure you included "Bearer " prefix in the Authorization header
3. Check for trailing spaces or incorrect characters

### Token Not Working

1. Ensure the environment variable name is exactly `MCP_AUTH_TOKEN`
2. Check Zeabur logs for any startup errors
3. Try generating a new token without special characters
4. Verify the service redeployed after adding the environment variable

## Example: Complete Setup Flow

```bash
# 1. Generate a token
$ node scripts/generate-token.js
🔐 MCP Authentication Token Generator

Choose one of these secure tokens for your MCP_AUTH_TOKEN:

Option 1: xKj3n_9mP2qR5sT7uV8wX0yZ1aB4cD6e
Option 2: mN8pQ4rS6tU9vW2xY5zA3bC7dE1fG0hJ
Option 3: aB4cD7eF0gH3jK6mN9pQ2rS5tU8vW1xY

# 2. Copy one token (e.g., Option 1)

# 3. Add to Zeabur:
# - Go to Zeabur Dashboard
# - Add environment variable:
#   MCP_AUTH_TOKEN = xKj3n_9mP2qR5sT7uV8wX0yZ1aB4cD6e

# 4. Update Claude Desktop config with the same token

# 5. Test the connection
```

## Without Authentication (Not Recommended)

If you want to disable authentication (only for testing):
1. Don't set `MCP_AUTH_TOKEN` on Zeabur
2. Don't include the Authorization header in Claude Desktop config

⚠️ **Warning**: This leaves your Airtable data accessible to anyone with your server URL!