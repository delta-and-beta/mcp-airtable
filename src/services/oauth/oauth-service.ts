import crypto from 'crypto';
import { OAuthConfig, TokenSet, TokenStore, OAuthError } from './types.js';

/**
 * Service for handling OAuth 2.0 flow with Airtable
 */
export class OAuthService {
  constructor(
    private config: OAuthConfig,
    private tokenStore: TokenStore
  ) {}

  /**
   * Generate authorization URL for OAuth flow
   */
  getAuthorizationUrl(userId?: string): { url: string; state: string } {
    const state = crypto.randomBytes(32).toString('hex');
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes,
      state,
    });

    // Store the authorization request
    this.tokenStore.setAuthorizationRequest(state, {
      state,
      redirectUri: this.config.redirectUri,
      userId,
    });

    const url = `${this.config.authorizationUrl}?${params.toString()}`;
    return { url, state };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<{ tokens: TokenSet; userId?: string }> {
    // Retrieve and validate state
    const authRequest = await this.tokenStore.getAndDeleteAuthorizationRequest(state);
    if (!authRequest) {
      throw new OAuthError('Invalid or expired state parameter', 'invalid_state');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: authRequest.redirectUri,
      client_id: this.config.clientId,
    });

    // Only add client_secret if it's provided (some OAuth providers don't require it)
    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new OAuthError(
          `Token exchange failed: ${error}`,
          'token_exchange_failed',
          response.status
        );
      }

      const data = await response.json() as any;
      
      const tokens: TokenSet = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
        scope: data.scope,
        tokenType: data.token_type || 'Bearer',
      };

      // Store tokens if we have a userId
      if (authRequest.userId) {
        await this.tokenStore.setTokens(authRequest.userId, tokens);
      }

      return { tokens, userId: authRequest.userId };
    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      throw new OAuthError(
        `Failed to exchange code for tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'token_exchange_error',
        500
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    if (this.config.clientSecret) {
      params.append('client_secret', this.config.clientSecret);
    }

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new OAuthError(
          `Token refresh failed: ${error}`,
          'token_refresh_failed',
          response.status
        );
      }

      const data = await response.json() as any;
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
        expiresAt: Date.now() + (data.expires_in * 1000),
        scope: data.scope,
        tokenType: data.token_type || 'Bearer',
      };
    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      throw new OAuthError(
        `Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'token_refresh_error',
        500
      );
    }
  }

  /**
   * Get valid access token for a user (auto-refresh if needed)
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.tokenStore.getTokens(userId);
    
    if (!tokens) {
      throw new OAuthError('No tokens found for user', 'no_tokens', 401);
    }

    // Check if token is expired or about to expire (5 minutes buffer)
    const now = Date.now();
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    
    if (tokens.expiresAt <= now + expiryBuffer) {
      if (!tokens.refreshToken) {
        throw new OAuthError('Token expired and no refresh token available', 'token_expired', 401);
      }

      try {
        const newTokens = await this.refreshAccessToken(tokens.refreshToken);
        await this.tokenStore.setTokens(userId, newTokens);
        return newTokens.accessToken;
      } catch (error) {
        // If refresh fails, delete the invalid tokens
        await this.tokenStore.deleteTokens(userId);
        throw error;
      }
    }

    return tokens.accessToken;
  }

  /**
   * Revoke tokens for a user
   */
  async revokeTokens(userId: string): Promise<void> {
    await this.tokenStore.deleteTokens(userId);
  }
}