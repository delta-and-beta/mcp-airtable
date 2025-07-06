import { RateLimitError } from './errors.js';
import { logger } from './logger.js';

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  maxRetries?: number;
  backoffMultiplier?: number;
  useQueue?: boolean;
}

interface RequestContext {
  baseId?: string;
  operation?: string;
  priority?: number;
}

export class EnhancedRateLimiter {
  private requests = new Map<string, number[]>();
  private maxRequests: number;
  private windowMs: number;
  private maxRetries: number;
  private backoffMultiplier: number;
  private useQueue: boolean;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.maxRetries = options.maxRetries || 3;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.useQueue = options.useQueue ?? true;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: RequestContext = {}
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.acquire(context);
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on non-rate-limit errors
        if (!(error instanceof RateLimitError) && 
            !(error instanceof Error && error.message.includes('429'))) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const backoffTime = this.calculateBackoff(attempt);
          logger.warn('Rate limit hit, backing off', {
            attempt: attempt + 1,
            backoffMs: backoffTime,
            context,
          });
          
          await this.sleep(backoffTime);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private async acquire(context: RequestContext): Promise<void> {
    const key = context.baseId || 'global';
    const now = Date.now();
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const timestamps = this.requests.get(key)!;
    
    // Remove old timestamps
    const validTimestamps = timestamps.filter(
      timestamp => now - timestamp < this.windowMs
    );
    this.requests.set(key, validTimestamps);
    
    // Check if at limit
    if (validTimestamps.length >= this.maxRequests) {
      const oldestTimestamp = validTimestamps[0];
      const waitTime = oldestTimestamp + this.windowMs - now;
      
      if (waitTime > 0) {
        // If queue is enabled, enqueue instead of throwing
        if (this.useQueue && context.operation) {
          logger.debug('Rate limit reached, queueing operation', { context });
          throw new RateLimitError(
            `Rate limit exceeded. Operation will be queued. Wait time: ${Math.ceil(waitTime / 1000)}s`
          );
        }
        
        throw new RateLimitError(
          `Rate limit exceeded. Please retry after ${Math.ceil(waitTime / 1000)} seconds.`
        );
      }
    }
    
    // Add current timestamp
    validTimestamps.push(now);
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const exponentialDelay = baseDelay * Math.pow(this.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }

  getStats(key?: string): { current: number; limit: number; resetIn: number } {
    const targetKey = key || 'global';
    const now = Date.now();
    const timestamps = this.requests.get(targetKey) || [];
    
    const validTimestamps = timestamps.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    const oldestTimestamp = validTimestamps[0] || now;
    const resetIn = Math.max(0, oldestTimestamp + this.windowMs - now);
    
    return {
      current: validTimestamps.length,
      limit: this.maxRequests,
      resetIn,
    };
  }
}

// Create instances for different use cases
export const airtableRateLimiter = new EnhancedRateLimiter({
  maxRequests: 5,
  windowMs: 1000,
  maxRetries: 3,
  backoffMultiplier: 2,
  useQueue: true,
});

export const clientRateLimiter = new EnhancedRateLimiter({
  maxRequests: 100,
  windowMs: 60000,
  maxRetries: 2,
  backoffMultiplier: 1.5,
  useQueue: false,
});