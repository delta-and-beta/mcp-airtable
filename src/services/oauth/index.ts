import { getConfig } from '../../config/index.js';
import { OAuthService } from './oauth-service.js';
import { InMemoryTokenStore } from './memory-token-store.js';
import { RedisTokenStore } from './redis-token-store.js';
import { TokenStore, OAuthConfig } from './types.js';

let oauthService: OAuthService | null = null;
let tokenStore: TokenStore | null = null;

/**
 * Get or create the OAuth service instance
 */
export function getOAuthService(): OAuthService | null {
  if (!oauthService) {
    const config = getConfig();
    
    if (!config.AIRTABLE_OAUTH_ENABLED) {
      return null;
    }

    // Create token store based on configuration
    if (!tokenStore) {
      if (config.TOKEN_STORE_TYPE === 'redis' && config.REDIS_URL) {
        tokenStore = new RedisTokenStore(config.REDIS_URL);
      } else {
        tokenStore = new InMemoryTokenStore();
        if (config.NODE_ENV === 'production') {
          console.warn('Using in-memory token store in production. Tokens will be lost on restart.');
        }
      }
    }

    // Create OAuth configuration
    const oauthConfig: OAuthConfig = {
      clientId: config.AIRTABLE_OAUTH_CLIENT_ID!,
      clientSecret: config.AIRTABLE_OAUTH_CLIENT_SECRET,
      redirectUri: config.AIRTABLE_OAUTH_REDIRECT_URI!,
      scopes: config.AIRTABLE_OAUTH_SCOPES,
      authorizationUrl: config.AIRTABLE_OAUTH_AUTHORIZATION_URL,
      tokenUrl: config.AIRTABLE_OAUTH_TOKEN_URL,
    };

    oauthService = new OAuthService(oauthConfig, tokenStore);
  }

  return oauthService;
}

/**
 * Get the token store instance
 */
export function getTokenStore(): TokenStore | null {
  if (!tokenStore) {
    getOAuthService(); // This will initialize the token store
  }
  return tokenStore;
}

// Export types
export * from './types.js';