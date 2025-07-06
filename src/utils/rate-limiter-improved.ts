import { RateLimitError } from './errors.js';

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (context: any) => string;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

export class ImprovedRateLimiter {
  private requests = new Map<string, RequestRecord[]>();
  private maxRequests: number;
  private windowMs: number;
  private keyGenerator: (context: any) => string;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.keyGenerator = options.keyGenerator || (() => 'global');
    
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async acquire(context?: any): Promise<void> {
    const key = this.keyGenerator(context);
    const now = Date.now();
    
    // Get or create request records for this key
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const records = this.requests.get(key)!;
    
    // Remove expired records
    const validRecords = records.filter(
      record => now - record.timestamp < this.windowMs
    );
    
    // Check if we're at the limit
    const requestCount = validRecords.reduce((sum, record) => sum + record.count, 0);
    
    if (requestCount >= this.maxRequests) {
      // Calculate wait time until the oldest request expires
      const oldestRecord = validRecords[0];
      const waitTime = oldestRecord.timestamp + this.windowMs - now;
      
      if (waitTime > 0) {
        throw new RateLimitError(
          `Rate limit exceeded. Please retry after ${Math.ceil(waitTime / 1000)} seconds.`
        );
      }
    }
    
    // Add current request
    validRecords.push({ timestamp: now, count: 1 });
    this.requests.set(key, validRecords);
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Remove expired entries to prevent memory leaks
    for (const [key, records] of this.requests.entries()) {
      const validRecords = records.filter(
        record => now - record.timestamp < this.windowMs
      );
      
      if (validRecords.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRecords);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

// Rate limiter instances
export const airtableRateLimiter = new ImprovedRateLimiter({
  maxRequests: 5,
  windowMs: 1000,
  keyGenerator: (context) => context?.baseId || 'global',
});

export const clientRateLimiter = new ImprovedRateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  keyGenerator: (context) => context?.clientId || context?.ip || 'anonymous',
});

// Cleanup on process exit
process.on('exit', () => {
  airtableRateLimiter.destroy();
  clientRateLimiter.destroy();
});