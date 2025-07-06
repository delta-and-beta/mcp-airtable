interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    
    // Remove requests outside the window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    // Check if we're at the limit
    if (this.requests.length >= this.maxRequests) {
      // Calculate wait time until the oldest request expires
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.windowMs - now;
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Retry after waiting
        return this.acquire();
      }
    }

    // Add current request
    this.requests.push(now);
  }
}

// Airtable rate limiter: 5 requests per second per base
export const airtableRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 1000,
});