# OAuth Setup Guide for MCP Airtable Server

This guide explains how to set up and use OAuth authentication with the MCP Airtable server.

## Overview

The MCP Airtable server supports two authentication methods:
1. **API Key Authentication** (default) - Using Personal Access Tokens
2. **OAuth Authentication** (new) - Using OAuth 2.0 flow

## Prerequisites

1. An Airtable account
2. Access to [Airtable's OAuth integration page](https://airtable.com/create/oauth)

## Setting Up OAuth

### Step 1: Register Your OAuth Integration

1. Go to https://airtable.com/create/oauth
2. Click "Register new OAuth integration"
3. Fill in the following details:
   - **Name**: Your integration name (e.g., "MCP Airtable Server")
   - **Redirect URL**: Your callback URL (e.g., `http://localhost:4000/oauth/callback`)
   - **Scopes**: Select the required permissions:
     - `data.records:read` - Read records
     - `data.records:write` - Write records
     - `schema.bases:read` - Read base schema

4. After registration, you'll receive:
   - **Client ID**
   - **Client Secret** (optional, depending on your OAuth flow)

### Step 2: Configure Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Enable OAuth
AIRTABLE_OAUTH_ENABLED=true

# OAuth credentials from Airtable
AIRTABLE_OAUTH_CLIENT_ID=your_client_id_here
AIRTABLE_OAUTH_CLIENT_SECRET=your_client_secret_here  # Optional
AIRTABLE_OAUTH_REDIRECT_URI=http://localhost:4000/oauth/callback

# OAuth scopes (space-separated)
AIRTABLE_OAUTH_SCOPES=data.records:read data.records:write schema.bases:read

# Session secret for OAuth state management
OAUTH_SESSION_SECRET=your_random_secret_here

# Token storage configuration
TOKEN_STORE_TYPE=memory  # Use 'redis' for production
# REDIS_URL=redis://localhost:6379  # Required if TOKEN_STORE_TYPE=redis
```

### Step 3: Start the Server

Run the HTTP server with OAuth enabled:

```bash
npm run dev:server
```

## OAuth Flow

### 1. Initiate Authorization

Direct users to start the OAuth flow:

```bash
GET http://localhost:4000/oauth/authorize?user_id=unique_user_id
```

Optional parameters:
- `user_id`: Unique identifier for the user (recommended)
- `return_state=true`: Returns JSON with authorization URL instead of redirecting

### 2. User Authorization

The user will be redirected to Airtable to authorize your application. After authorization, they'll be redirected back to your callback URL.

### 3. Handle Callback

The server automatically handles the callback at `/oauth/callback` and:
- Exchanges the authorization code for tokens
- Stores tokens securely
- Returns success confirmation

### 4. Check OAuth Status

Check if a user has valid OAuth tokens:

```bash
GET http://localhost:4000/oauth/status/{user_id}
```

Response:
```json
{
  "authorized": true,
  "expired": false,
  "expires_in": 3600,
  "has_refresh_token": true,
  "scope": "data.records:read data.records:write schema.bases:read"
}
```

## Using OAuth in MCP Tools

Once OAuth is set up, you can use it in three ways:

### Option 1: Direct OAuth Token

Pass the OAuth access token directly:

```json
{
  "tool": "list_tables",
  "arguments": {
    "oauthToken": "access_token_here",
    "baseId": "appXXXXXXXXXXXXXX"
  }
}
```

### Option 2: User ID (Recommended)

Pass the user ID, and the server will automatically fetch the stored OAuth token:

```json
{
  "tool": "list_tables",
  "arguments": {
    "userId": "unique_user_id",
    "baseId": "appXXXXXXXXXXXXXX"
  }
}
```

### Option 3: HTTP Headers

For HTTP transport, pass OAuth credentials via headers:

```bash
X-Airtable-OAuth-Token: your_oauth_access_token
X-Airtable-User-ID: unique_user_id
```

## Token Management

### Automatic Token Refresh

The server automatically refreshes expired tokens when:
- A request is made with an expired token
- The user has a valid refresh token

### Manual Token Refresh

Refresh tokens manually:

```bash
POST http://localhost:4000/oauth/refresh
Content-Type: application/json

{
  "refresh_token": "refresh_token_here",
  "user_id": "unique_user_id"  # Optional
}
```

### Revoke Tokens

Revoke OAuth tokens for a user:

```bash
DELETE http://localhost:4000/oauth/revoke/{user_id}
```

## Production Considerations

### 1. Use Redis for Token Storage

In production, use Redis instead of in-memory storage:

```bash
TOKEN_STORE_TYPE=redis
REDIS_URL=redis://your-redis-server:6379
```

### 2. Secure Your Endpoints

- Use HTTPS for all OAuth endpoints
- Set strong session secrets
- Implement rate limiting
- Add authentication to sensitive endpoints

### 3. Handle Errors Gracefully

The server includes automatic fallback to API key authentication if OAuth fails. Monitor logs for OAuth errors.

## Troubleshooting

### Common Issues

1. **"OAuth is not enabled" error**
   - Ensure `AIRTABLE_OAUTH_ENABLED=true` is set
   - Check that all required OAuth environment variables are configured

2. **"Invalid state parameter" error**
   - The OAuth state has expired (10-minute timeout)
   - User needs to restart the authorization flow

3. **Token refresh fails**
   - The refresh token may be expired
   - User needs to re-authorize

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev:server
```

## Security Best Practices

1. **Never expose tokens**: Don't log or return actual tokens in responses
2. **Use HTTPS**: Always use HTTPS in production for OAuth callbacks
3. **Validate state**: The server validates OAuth state parameters to prevent CSRF
4. **Rotate secrets**: Regularly rotate your OAuth client secret and session secret
5. **Monitor usage**: Track OAuth token usage and revocation events

## Example Integration

Here's a complete example of using OAuth with the MCP server:

```javascript
// 1. Start OAuth flow
const response = await fetch('http://localhost:4000/oauth/authorize?user_id=user123&return_state=true');
const { authorization_url } = await response.json();

// 2. Redirect user to authorization_url
window.location.href = authorization_url;

// 3. After callback, use the authenticated user
const result = await fetch('http://localhost:4000/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_MCP_AUTH_TOKEN',
  },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'list_tables',
      arguments: {
        userId: 'user123',
        baseId: 'appXXXXXXXXXXXXXX'
      }
    }
  })
});
```

## Migration from API Keys

To migrate from API keys to OAuth:

1. Enable OAuth alongside API keys
2. Implement OAuth flow for new users
3. Gradually migrate existing users
4. Monitor both authentication methods
5. Eventually deprecate API key support

## Support

For issues or questions:
- Check the [main README](../README.md)
- Review the [OAuth design document](./OAUTH_DESIGN.md)
- Submit issues on GitHub