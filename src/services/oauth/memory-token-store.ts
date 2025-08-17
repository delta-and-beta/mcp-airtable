import { TokenSet, TokenStore, AuthorizationRequest } from './types.js';

/**
 * In-memory token store implementation.
 * WARNING: This is for development only. Tokens are lost on restart.
 */
export class InMemoryTokenStore implements TokenStore {
  private tokens = new Map<string, TokenSet>();
  private authRequests = new Map<string, AuthorizationRequest>();

  async setTokens(userId: string, tokens: TokenSet): Promise<void> {
    this.tokens.set(userId, tokens);
  }

  async getTokens(userId: string): Promise<TokenSet | null> {
    return this.tokens.get(userId) || null;
  }

  async deleteTokens(userId: string): Promise<void> {
    this.tokens.delete(userId);
  }

  async setAuthorizationRequest(state: string, request: AuthorizationRequest): Promise<void> {
    this.authRequests.set(state, request);
    
    // Auto-cleanup after 10 minutes
    setTimeout(() => {
      this.authRequests.delete(state);
    }, 10 * 60 * 1000);
  }

  async getAndDeleteAuthorizationRequest(state: string): Promise<AuthorizationRequest | null> {
    const request = this.authRequests.get(state);
    if (request) {
      this.authRequests.delete(state);
    }
    return request || null;
  }

  // Utility method for development
  clear(): void {
    this.tokens.clear();
    this.authRequests.clear();
  }
}