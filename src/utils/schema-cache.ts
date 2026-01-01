import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Cache entry with timestamp for TTL management
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Schema cache with Redis persistence and in-memory fallback.
 * Reduces API calls by caching table schemas and base metadata.
 */
class SchemaCache {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private redis: Redis | null = null;
  private readonly TTL_SECONDS = 5 * 60; // 5 minutes
  private readonly KEY_PREFIX = 'mcp:schema:';
  private readonly MAX_MEMORY_ENTRIES = 100;

  constructor() {
    this.initRedis();
  }

  private initRedis(): void {
    // Only initialize Redis if configured
    if (config.REDIS_URL || config.REDIS_HOST) {
      try {
        let redisClient: Redis;

        if (config.REDIS_URL) {
          redisClient = new Redis(config.REDIS_URL, {
            maxRetriesPerRequest: 1,
            lazyConnect: true,
          });
        } else {
          const port = typeof config.REDIS_PORT === 'string'
            ? parseInt(config.REDIS_PORT, 10)
            : (config.REDIS_PORT || 6379);
          redisClient = new Redis({
            host: config.REDIS_HOST || 'localhost',
            port,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
          });
        }

        redisClient.on('error', (err: Error) => {
          logger.warn('Redis cache error, falling back to memory', { error: err.message });
          this.redis = null;
        });

        redisClient.on('connect', () => {
          logger.debug('Schema cache connected to Redis');
        });

        this.redis = redisClient;
      } catch (error) {
        logger.warn('Failed to initialize Redis for schema cache', { error });
        this.redis = null;
      }
    }
  }

  /**
   * Get cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.KEY_PREFIX + key;

    // Try Redis first
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          logger.debug('Schema cache hit (Redis)', { key });
          return JSON.parse(cached) as T;
        }
      } catch (error) {
        logger.debug('Redis cache get error', { key, error });
      }
    }

    // Fall back to memory cache
    const entry = this.memoryCache.get(cacheKey);
    if (entry) {
      const ageMs = Date.now() - entry.timestamp;
      if (ageMs < this.TTL_SECONDS * 1000) {
        logger.debug('Schema cache hit (memory)', { key, ageMs });
        return entry.data as T;
      }
      // Expired, remove from memory
      this.memoryCache.delete(cacheKey);
    }

    logger.debug('Schema cache miss', { key });
    return null;
  }

  /**
   * Set cached value with TTL
   */
  async set<T>(key: string, data: T): Promise<void> {
    const cacheKey = this.KEY_PREFIX + key;

    // Store in Redis with TTL
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, this.TTL_SECONDS, JSON.stringify(data));
        logger.debug('Schema cached to Redis', { key, ttl: this.TTL_SECONDS });
      } catch (error) {
        logger.debug('Redis cache set error', { key, error });
      }
    }

    // Also store in memory (as backup and for faster access)
    this.memoryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    // Cleanup old entries if memory cache is too large
    if (this.memoryCache.size > this.MAX_MEMORY_ENTRIES) {
      this.cleanupMemoryCache();
    }
  }

  /**
   * Invalidate a cached entry
   */
  async invalidate(key: string): Promise<void> {
    const cacheKey = this.KEY_PREFIX + key;

    this.memoryCache.delete(cacheKey);

    if (this.redis) {
      try {
        await this.redis.del(cacheKey);
        logger.debug('Schema cache invalidated', { key });
      } catch (error) {
        logger.debug('Redis cache invalidate error', { key, error });
      }
    }
  }

  /**
   * Invalidate all cached entries for a base
   */
  async invalidateBase(baseId: string): Promise<void> {
    // Invalidate memory cache entries for this base
    for (const key of this.memoryCache.keys()) {
      if (key.includes(baseId)) {
        this.memoryCache.delete(key);
      }
    }

    // Invalidate Redis entries
    if (this.redis) {
      try {
        const pattern = `${this.KEY_PREFIX}*${baseId}*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          logger.debug('Schema cache base invalidated', { baseId, keysRemoved: keys.length });
        }
      } catch (error) {
        logger.debug('Redis cache base invalidate error', { baseId, error });
      }
    }
  }

  /**
   * Clean up oldest entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const entries = Array.from(this.memoryCache.entries());
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 20% of entries
    const removeCount = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < removeCount; i++) {
      this.memoryCache.delete(entries[i][0]);
    }

    logger.debug('Schema cache memory cleanup', { removed: removeCount, remaining: this.memoryCache.size });
  }

  /**
   * Get cache statistics
   */
  getStats(): { memoryEntries: number; redisConnected: boolean } {
    return {
      memoryEntries: this.memoryCache.size,
      redisConnected: this.redis !== null,
    };
  }
}

// Export singleton instance
export const schemaCache = new SchemaCache();

/**
 * Helper to generate cache keys
 */
export function cacheKey(type: 'tables' | 'schema' | 'views', baseId: string, extra?: string): string {
  return extra ? `${type}:${baseId}:${extra}` : `${type}:${baseId}`;
}
