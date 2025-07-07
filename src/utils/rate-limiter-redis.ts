import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

/**
 * Redis-based rate limiter with in-memory fallback
 */
export class RedisRateLimiter {
  private redis: Redis | null = null;
  private inMemoryStore = new Map<string, number[]>();
  private options: RateLimiterOptions;
  
  constructor(options: RateLimiterOptions) {
    this.options = options;
    this.initRedis();
  }
  
  private initRedis() {
    if (config.REDIS_URL) {
      try {
        this.redis = new Redis(config.REDIS_URL, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          enableOfflineQueue: false,
        });
        
        this.redis.on('error', (err: Error) => {
          logger.error('Redis connection error', err);
          // Fall back to in-memory
          this.redis = null;
        });
        
        this.redis.on('connect', () => {
          logger.info('Redis rate limiter connected');
        });
      } catch (error) {
        logger.warn('Failed to initialize Redis rate limiter, using in-memory fallback', { error: (error as Error).message });
        this.redis = null;
      }
    }
  }
  
  /**
   * Acquire rate limit permission for a given key
   * @param key Unique identifier (e.g., IP address, user ID, API key)
   * @returns true if allowed, false if rate limited
   */
  async acquire(key: string): Promise<boolean> {
    const fullKey = `${this.options.keyPrefix || 'ratelimit'}:${key}`;
    
    if (this.redis) {
      return this.acquireRedis(fullKey);
    }
    
    return this.acquireInMemory(fullKey);
  }
  
  private async acquireRedis(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    const pipeline = this.redis!.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    
    // Count current entries
    pipeline.zcard(key);
    
    // Add current request if under limit
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry
    pipeline.expire(key, Math.ceil(this.options.windowMs / 1000));
    
    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Redis pipeline execution failed');
    }
    
    const count = results[1][1] as number;
    
    if (count >= this.options.maxRequests) {
      // Remove the entry we just added
      await this.redis!.zrem(key, `${now}-${Math.random()}`);
      return false;
    }
    
    return true;
  }
  
  private acquireInMemory(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    // Get or create request array for this key
    let requests = this.inMemoryStore.get(key) || [];
    
    // Filter out old requests
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if we're at the limit
    if (requests.length >= this.options.maxRequests) {
      return false;
    }
    
    // Add current request
    requests.push(now);
    this.inMemoryStore.set(key, requests);
    
    // Clean up old keys periodically
    if (this.inMemoryStore.size > 1000) {
      this.cleanupInMemory();
    }
    
    return true;
  }
  
  private cleanupInMemory() {
    const now = Date.now();
    for (const [key, requests] of this.inMemoryStore.entries()) {
      const validRequests = requests.filter(
        timestamp => now - timestamp < this.options.windowMs
      );
      
      if (validRequests.length === 0) {
        this.inMemoryStore.delete(key);
      } else {
        this.inMemoryStore.set(key, validRequests);
      }
    }
  }
  
  /**
   * Get remaining requests for a key
   */
  async getRemaining(key: string): Promise<number> {
    const fullKey = `${this.options.keyPrefix || 'ratelimit'}:${key}`;
    
    if (this.redis) {
      const now = Date.now();
      const windowStart = now - this.options.windowMs;
      
      await this.redis.zremrangebyscore(fullKey, '-inf', windowStart);
      const count = await this.redis.zcard(fullKey);
      
      return Math.max(0, this.options.maxRequests - count);
    }
    
    const requests = this.inMemoryStore.get(fullKey) || [];
    const now = Date.now();
    const validRequests = requests.filter(
      timestamp => now - timestamp < this.options.windowMs
    );
    
    return Math.max(0, this.options.maxRequests - validRequests.length);
  }
  
  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    const fullKey = `${this.options.keyPrefix || 'ratelimit'}:${key}`;
    
    if (this.redis) {
      await this.redis.del(fullKey);
    } else {
      this.inMemoryStore.delete(fullKey);
    }
  }
  
  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
  
  /**
   * Execute a function with retry logic and rate limiting
   * For compatibility with existing code
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: { baseId?: string; operation?: string }
  ): Promise<T> {
    const maxRetries = 3;
    const backoffMultiplier = 2;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Use baseId as key if provided, otherwise use 'global'
        const key = context?.baseId || 'global';
        const allowed = await this.acquire(key);
        
        if (!allowed) {
          throw new Error('Rate limit exceeded');
        }
        
        // Execute the function
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries - 1) {
          // Calculate backoff time
          const baseDelay = 1000;
          const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt);
          const jitter = Math.random() * 0.3 * exponentialDelay;
          const backoffTime = Math.min(exponentialDelay + jitter, 30000);
          
          logger.warn(`Operation failed, retrying...`, {
            attempt: attempt + 1,
            maxRetries,
            backoffTime,
            error: lastError.message,
          });
          
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
  
  /**
   * Get rate limit statistics
   * For compatibility with existing code
   */
  async getStats(key?: string): Promise<{ current: number; limit: number; resetIn: number }> {
    const remaining = await this.getRemaining(key || 'global');
    const current = this.options.maxRequests - remaining;
    
    return {
      current,
      limit: this.options.maxRequests,
      resetIn: this.options.windowMs, // Approximate, since we use sliding window
    };
  }
}

// Export rate limiters for different purposes
export const apiRateLimiter = new RedisRateLimiter({
  maxRequests: config.RATE_LIMIT_REQUESTS_PER_MINUTE || 60,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'api',
});

export const airtableRateLimiter = new RedisRateLimiter({
  maxRequests: 5,
  windowMs: 1000, // 1 second (Airtable limit)
  keyPrefix: 'airtable',
});

// Express middleware for API rate limiting
export function rateLimitMiddleware(keyExtractor?: (req: any) => string) {
  return async (req: any, res: any, next: any) => {
    if (!config.RATE_LIMIT_ENABLED) {
      return next();
    }
    
    // Extract key from request (default to IP)
    const key = keyExtractor ? keyExtractor(req) : req.ip || 'unknown';
    
    const allowed = await apiRateLimiter.acquire(key);
    const remaining = await apiRateLimiter.getRemaining(key);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.RATE_LIMIT_REQUESTS_PER_MINUTE || 60);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString());
    
    if (!allowed) {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 60,
      });
      return;
    }
    
    next();
  };
}