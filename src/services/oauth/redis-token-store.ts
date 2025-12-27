/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import Redis from 'ioredis';
import { TokenSet, TokenStore, AuthorizationRequest } from './types.js';

/**
 * Redis-based token store implementation for production use.
 */
export class RedisTokenStore implements TokenStore {
  private redis: any;
  private readonly TOKEN_PREFIX = 'oauth:tokens:';
  private readonly AUTH_REQUEST_PREFIX = 'oauth:auth:';
  private readonly TOKEN_TTL = 90 * 24 * 60 * 60; // 90 days
  private readonly AUTH_REQUEST_TTL = 10 * 60; // 10 minutes

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async setTokens(userId: string, tokens: TokenSet): Promise<void> {
    const key = `${this.TOKEN_PREFIX}${userId}`;
    await this.redis.setex(
      key,
      this.TOKEN_TTL,
      JSON.stringify(tokens)
    );
  }

  async getTokens(userId: string): Promise<TokenSet | null> {
    const key = `${this.TOKEN_PREFIX}${userId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as TokenSet;
    } catch (error) {
      console.error('Failed to parse token data:', error);
      return null;
    }
  }

  async deleteTokens(userId: string): Promise<void> {
    const key = `${this.TOKEN_PREFIX}${userId}`;
    await this.redis.del(key);
  }

  async setAuthorizationRequest(state: string, request: AuthorizationRequest): Promise<void> {
    const key = `${this.AUTH_REQUEST_PREFIX}${state}`;
    await this.redis.setex(
      key,
      this.AUTH_REQUEST_TTL,
      JSON.stringify(request)
    );
  }

  async getAndDeleteAuthorizationRequest(state: string): Promise<AuthorizationRequest | null> {
    const key = `${this.AUTH_REQUEST_PREFIX}${state}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    // Delete the key after reading
    await this.redis.del(key);

    try {
      return JSON.parse(data) as AuthorizationRequest;
    } catch (error) {
      console.error('Failed to parse authorization request:', error);
      return null;
    }
  }

  // Cleanup method
  async close(): Promise<void> {
    await this.redis.quit();
  }
}