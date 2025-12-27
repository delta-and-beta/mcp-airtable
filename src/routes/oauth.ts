/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { Router } from 'express';
import { getOAuthService, OAuthError } from '../services/oauth/index.js';

const router = Router();

/**
 * GET /oauth/authorize
 * Initiate OAuth authorization flow
 */
router.get('/authorize', (req, res) => {
  try {
    const oauthService = getOAuthService();
    
    if (!oauthService) {
      return res.status(501).json({
        error: 'OAuth is not enabled',
        message: 'OAuth functionality is not configured on this server',
      });
    }

    // Optional: Get userId from query params or session
    const userId = req.query.user_id as string | undefined;
    
    const { url, state } = oauthService.getAuthorizationUrl(userId);
    
    // Optionally return state for client-side storage
    if (req.query.return_state === 'true') {
      return res.json({ authorization_url: url, state });
    }
    
    // Default: redirect to authorization URL
    return res.redirect(url);
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return res.status(500).json({
      error: 'Failed to initiate OAuth flow',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /oauth/callback
 * Handle OAuth callback from Airtable
 */
router.get('/callback', async (req, res) => {
  try {
    const oauthService = getOAuthService();
    
    if (!oauthService) {
      return res.status(501).json({
        error: 'OAuth is not enabled',
        message: 'OAuth functionality is not configured on this server',
      });
    }

    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      return res.status(400).json({
        error: error as string,
        message: error_description as string || 'OAuth authorization failed',
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Authorization code and state are required',
      });
    }

    // Exchange code for tokens
    const { tokens, userId } = await oauthService.exchangeCodeForTokens(
      code as string,
      state as string
    );

    // Success response - you might want to customize this
    // In a real app, you might redirect to a success page or return tokens
    return res.json({
      success: true,
      message: 'OAuth authorization successful',
      userId,
      token_type: tokens.tokenType,
      expires_in: Math.floor((tokens.expiresAt - Date.now()) / 1000),
      scope: tokens.scope,
      // Don't return actual tokens in response for security
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    
    if (error instanceof OAuthError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'oauth_callback_failed',
      message: error instanceof Error ? error.message : 'Failed to complete OAuth flow',
    });
  }
});

/**
 * POST /oauth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const oauthService = getOAuthService();
    
    if (!oauthService) {
      return res.status(501).json({
        error: 'OAuth is not enabled',
        message: 'OAuth functionality is not configured on this server',
      });
    }

    const { refresh_token, user_id } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Missing refresh token',
        message: 'Refresh token is required',
      });
    }

    const tokens = await oauthService.refreshAccessToken(refresh_token);

    // If userId provided, update stored tokens
    if (user_id) {
      const tokenStore = getOAuthService()?.['tokenStore'];
      if (tokenStore) {
        await tokenStore.setTokens(user_id, tokens);
      }
    }

    return res.json({
      access_token: tokens.accessToken,
      token_type: tokens.tokenType,
      expires_in: Math.floor((tokens.expiresAt - Date.now()) / 1000),
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    if (error instanceof OAuthError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'token_refresh_failed',
      message: error instanceof Error ? error.message : 'Failed to refresh token',
    });
  }
});

/**
 * DELETE /oauth/revoke
 * Revoke OAuth tokens for a user
 */
router.delete('/revoke/:userId', async (req, res) => {
  try {
    const oauthService = getOAuthService();
    
    if (!oauthService) {
      return res.status(501).json({
        error: 'OAuth is not enabled',
        message: 'OAuth functionality is not configured on this server',
      });
    }

    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing user ID',
        message: 'User ID is required',
      });
    }

    await oauthService.revokeTokens(userId);

    return res.json({
      success: true,
      message: 'Tokens revoked successfully',
    });
  } catch (error) {
    console.error('Token revocation error:', error);
    
    return res.status(500).json({
      error: 'revocation_failed',
      message: error instanceof Error ? error.message : 'Failed to revoke tokens',
    });
  }
});

/**
 * GET /oauth/status/:userId
 * Check OAuth status for a user
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const oauthService = getOAuthService();
    
    if (!oauthService) {
      return res.status(501).json({
        error: 'OAuth is not enabled',
        message: 'OAuth functionality is not configured on this server',
      });
    }

    const { userId } = req.params;
    const tokenStore = getOAuthService()?.['tokenStore'];
    
    if (!tokenStore) {
      return res.status(500).json({
        error: 'Token store not available',
      });
    }

    const tokens = await tokenStore.getTokens(userId);

    if (!tokens) {
      return res.json({
        authorized: false,
        message: 'No tokens found for user',
      });
    }

    const now = Date.now();
    const isExpired = tokens.expiresAt <= now;
    const expiresIn = Math.max(0, Math.floor((tokens.expiresAt - now) / 1000));

    return res.json({
      authorized: true,
      expired: isExpired,
      expires_in: expiresIn,
      has_refresh_token: !!tokens.refreshToken,
      scope: tokens.scope,
    });
  } catch (error) {
    console.error('OAuth status error:', error);
    
    return res.status(500).json({
      error: 'status_check_failed',
      message: error instanceof Error ? error.message : 'Failed to check OAuth status',
    });
  }
});

export default router;