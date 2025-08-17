/**
 * OAuth related types and interfaces
 */

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp
  scope?: string;
  tokenType: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string;
  authorizationUrl: string;
  tokenUrl: string;
}

export interface AuthorizationRequest {
  state: string;
  codeVerifier?: string; // For PKCE
  redirectUri: string;
  userId?: string;
}

export interface TokenStore {
  // Store token set for a user
  setTokens(userId: string, tokens: TokenSet): Promise<void>;

  // Retrieve tokens for a user
  getTokens(userId: string): Promise<TokenSet | null>;

  // Delete tokens for a user
  deleteTokens(userId: string): Promise<void>;

  // Store authorization request state
  setAuthorizationRequest(state: string, request: AuthorizationRequest): Promise<void>;

  // Get and delete authorization request
  getAndDeleteAuthorizationRequest(state: string): Promise<AuthorizationRequest | null>;
}

export class OAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}