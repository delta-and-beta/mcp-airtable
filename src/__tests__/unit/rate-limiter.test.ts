import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RateLimiter } from "../../lib/rate-limiter.js";
import { RateLimitError } from "../../lib/errors.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter(10); // 10 requests per minute
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow requests under the limit", () => {
    for (let i = 0; i < 10; i++) {
      expect(() => limiter.check("user1")).not.toThrow();
    }
  });

  it("should throw RateLimitError when limit exceeded", () => {
    // Make 10 requests (at limit)
    for (let i = 0; i < 10; i++) {
      limiter.check("user1");
    }

    // 11th request should throw
    expect(() => limiter.check("user1")).toThrow(RateLimitError);
  });

  it("should include retryAfter in error", () => {
    for (let i = 0; i < 10; i++) {
      limiter.check("user1");
    }

    try {
      limiter.check("user1");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).retryAfter).toBeDefined();
      expect((error as RateLimitError).retryAfter).toBeGreaterThan(0);
    }
  });

  it("should track different keys independently", () => {
    // Use up limit for user1
    for (let i = 0; i < 10; i++) {
      limiter.check("user1");
    }

    // user2 should still be able to make requests
    expect(() => limiter.check("user2")).not.toThrow();
    expect(() => limiter.check("user3")).not.toThrow();
  });

  it("should reset after the time window", () => {
    // Use up limit
    for (let i = 0; i < 10; i++) {
      limiter.check("user1");
    }

    // Should be rate limited
    expect(() => limiter.check("user1")).toThrow(RateLimitError);

    // Advance time by 1 minute
    vi.advanceTimersByTime(60 * 1000);

    // Should be able to make requests again
    expect(() => limiter.check("user1")).not.toThrow();
  });

  it("should filter old requests within window", () => {
    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      limiter.check("user1");
    }

    // Advance 30 seconds
    vi.advanceTimersByTime(30 * 1000);

    // Make 5 more requests (still within limit since old ones haven't expired)
    for (let i = 0; i < 5; i++) {
      limiter.check("user1");
    }

    // Should be at limit now
    expect(() => limiter.check("user1")).toThrow(RateLimitError);

    // Advance another 31 seconds (first 5 requests should expire)
    vi.advanceTimersByTime(31 * 1000);

    // Should be able to make requests again
    expect(() => limiter.check("user1")).not.toThrow();
  });

  it("should use default limit if not specified", () => {
    const defaultLimiter = new RateLimiter();
    // Default is 60 requests per minute
    for (let i = 0; i < 60; i++) {
      expect(() => defaultLimiter.check("user")).not.toThrow();
    }
    expect(() => defaultLimiter.check("user")).toThrow(RateLimitError);
  });

  it("should handle empty key", () => {
    expect(() => limiter.check("")).not.toThrow();
    for (let i = 0; i < 9; i++) {
      limiter.check("");
    }
    expect(() => limiter.check("")).toThrow(RateLimitError);
  });

  it("should handle very high request count", () => {
    const highLimiter = new RateLimiter(1000);
    for (let i = 0; i < 1000; i++) {
      expect(() => highLimiter.check("user")).not.toThrow();
    }
    expect(() => highLimiter.check("user")).toThrow(RateLimitError);
  });

  it("should reset rate limit for a key", () => {
    // Use up limit
    for (let i = 0; i < 10; i++) {
      limiter.check("user1");
    }

    // Should be rate limited
    expect(() => limiter.check("user1")).toThrow(RateLimitError);

    // Reset the key
    limiter.reset("user1");

    // Should be able to make requests again immediately
    expect(() => limiter.check("user1")).not.toThrow();
  });

  it("should only reset specified key", () => {
    // Use up limit for both users
    for (let i = 0; i < 10; i++) {
      limiter.check("user1");
      limiter.check("user2");
    }

    // Reset only user1
    limiter.reset("user1");

    // user1 can make requests, user2 cannot
    expect(() => limiter.check("user1")).not.toThrow();
    expect(() => limiter.check("user2")).toThrow(RateLimitError);
  });
});
