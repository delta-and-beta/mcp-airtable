import { RateLimiter } from '../../utils/rate-limiter';
import { wait } from '../helpers/test-utils';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    rateLimiter = new RateLimiter(5, 1000); // 5 requests per second
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('executeWithLimit', () => {
    it('should execute functions within rate limit', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(rateLimiter.executeWithLimit(mockFn));
      }
      
      jest.runAllTimers();
      const results = await Promise.all(promises);
      
      expect(mockFn).toHaveBeenCalledTimes(5);
      expect(results).toEqual(['result', 'result', 'result', 'result', 'result']);
    });

    it('should delay execution when rate limit exceeded', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      
      // Execute 6 functions (1 more than limit)
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(rateLimiter.executeWithLimit(mockFn));
      }
      
      // First 5 should execute immediately
      jest.advanceTimersByTime(0);
      expect(mockFn).toHaveBeenCalledTimes(5);
      
      // 6th should wait for window to reset
      jest.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledTimes(6);
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(6);
    });

    it('should handle function errors', async () => {
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      jest.runAllTimers();
      
      await expect(rateLimiter.executeWithLimit(mockFn)).rejects.toThrow('Test error');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should maintain separate windows for rate limiting', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      
      // Execute 5 in first window
      for (let i = 0; i < 5; i++) {
        rateLimiter.executeWithLimit(mockFn);
      }
      jest.advanceTimersByTime(0);
      expect(mockFn).toHaveBeenCalledTimes(5);
      
      // Wait half window
      jest.advanceTimersByTime(500);
      
      // Try to execute more - should wait
      rateLimiter.executeWithLimit(mockFn);
      jest.advanceTimersByTime(0);
      expect(mockFn).toHaveBeenCalledTimes(5);
      
      // Complete the window
      jest.advanceTimersByTime(500);
      expect(mockFn).toHaveBeenCalledTimes(6);
    });
  });

  describe('reset', () => {
    it('should reset the rate limiter state', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      
      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.executeWithLimit(mockFn);
      }
      jest.advanceTimersByTime(0);
      expect(mockFn).toHaveBeenCalledTimes(5);
      
      // Reset the limiter
      rateLimiter.reset();
      
      // Should be able to execute 5 more immediately
      for (let i = 0; i < 5; i++) {
        rateLimiter.executeWithLimit(mockFn);
      }
      jest.advanceTimersByTime(0);
      expect(mockFn).toHaveBeenCalledTimes(10);
    });
  });

  describe('getStats', () => {
    it('should return current rate limiter statistics', () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      
      // Initial stats
      let stats = rateLimiter.getStats();
      expect(stats).toEqual({
        currentRequests: 0,
        maxRequests: 5,
        windowMs: 1000,
        queueLength: 0,
      });
      
      // Execute some requests
      for (let i = 0; i < 3; i++) {
        rateLimiter.executeWithLimit(mockFn);
      }
      
      stats = rateLimiter.getStats();
      expect(stats.currentRequests).toBe(3);
      expect(stats.queueLength).toBe(0);
      
      // Exceed limit
      for (let i = 0; i < 3; i++) {
        rateLimiter.executeWithLimit(mockFn);
      }
      
      stats = rateLimiter.getStats();
      expect(stats.currentRequests).toBe(5);
      expect(stats.queueLength).toBe(1);
    });
  });
});