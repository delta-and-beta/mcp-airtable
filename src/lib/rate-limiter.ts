/**
 * Simple in-memory rate limiter
 */

import { RateLimitError } from './errors.js';

interface RateLimitEntry {
  requests: number[];
  windowStart: number;
}

export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;

  constructor(requestsPerMinute: number = 60) {
    this.maxRequests = requestsPerMinute;
    this.windowMs = 60 * 1000; // 1 minute
  }

  check(key: string): void {
    const now = Date.now();
    const entry = this.limits.get(key) || { requests: [], windowStart: now };

    // Remove requests outside the current window
    entry.requests = entry.requests.filter(time => now - time < this.windowMs);

    if (entry.requests.length >= this.maxRequests) {
      const oldestRequest = entry.requests[0];
      const retryAfter = Math.ceil((this.windowMs - (now - oldestRequest)) / 1000);
      throw new RateLimitError(`Rate limit exceeded. Try again in ${retryAfter}s`, retryAfter);
    }

    entry.requests.push(now);
    this.limits.set(key, entry);
  }

  reset(key: string): void {
    this.limits.delete(key);
  }
}

export const rateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60')
);
