/**
 * Request queue with concurrency control
 * Limits the number of concurrent requests to prevent overwhelming the API
 */

import { logger } from "./logger.js";

export interface QueueOptions {
  /** Maximum concurrent requests (default: 5) */
  maxConcurrency?: number;
  /** Maximum queue size, 0 for unlimited (default: 100) */
  maxQueueSize?: number;
  /** Timeout for queued requests in milliseconds (default: 30000) */
  queueTimeoutMs?: number;
}

export interface QueueStats {
  concurrency: number;
  maxConcurrency: number;
  running: number;
  queued: number;
  completed: number;
  timedOut: number;
  rejected: number;
}

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  timeoutId?: NodeJS.Timeout;
}

const DEFAULT_OPTIONS: Required<QueueOptions> = {
  maxConcurrency: 5,
  maxQueueSize: 100,
  queueTimeoutMs: 30000,
};

/**
 * Request queue class for managing concurrent requests
 */
export class RequestQueue {
  private options: Required<QueueOptions>;
  private queue: QueuedRequest<unknown>[] = [];
  private running = 0;
  private completedCount = 0;
  private timedOutCount = 0;
  private rejectedCount = 0;

  constructor(options: QueueOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute a function with concurrency control
   * Returns immediately if under concurrency limit, otherwise queues the request
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can execute immediately
    if (this.running < this.options.maxConcurrency) {
      return this.runNow(fn);
    }

    // Check queue size limit
    if (this.options.maxQueueSize > 0 && this.queue.length >= this.options.maxQueueSize) {
      this.rejectedCount++;
      const error = new QueueFullError(
        `Request queue is full (${this.queue.length} requests queued)`,
        this.queue.length,
        this.options.maxQueueSize
      );
      logger.warn("Request queue full, rejecting request", {
        queueSize: this.queue.length,
        maxQueueSize: this.options.maxQueueSize,
      });
      throw error;
    }

    // Queue the request
    return this.enqueue(fn);
  }

  /**
   * Run a function immediately, tracking concurrency
   */
  private async runNow<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;
    try {
      const result = await fn();
      this.completedCount++;
      return result;
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  /**
   * Add a request to the queue
   */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        fn,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      // Set timeout for queued request
      if (this.options.queueTimeoutMs > 0) {
        request.timeoutId = setTimeout(() => {
          this.handleTimeout(request as unknown as QueuedRequest<unknown>);
        }, this.options.queueTimeoutMs);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.queue.push(request as any);

      logger.debug("Request queued", {
        queueSize: this.queue.length,
        running: this.running,
        maxConcurrency: this.options.maxConcurrency,
      });
    });
  }

  /**
   * Handle timeout for a queued request
   */
  private handleTimeout(request: QueuedRequest<unknown>): void {
    const index = this.queue.indexOf(request);
    if (index === -1) {
      return; // Already processed
    }

    this.queue.splice(index, 1);
    this.timedOutCount++;

    const waitTime = Date.now() - request.queuedAt;
    const error = new QueueTimeoutError(
      `Request timed out after waiting ${waitTime}ms in queue`,
      waitTime,
      this.options.queueTimeoutMs
    );

    logger.warn("Queued request timed out", {
      waitTimeMs: waitTime,
      timeoutMs: this.options.queueTimeoutMs,
      remainingInQueue: this.queue.length,
    });

    request.reject(error);
  }

  /**
   * Process the next request in the queue
   */
  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.options.maxConcurrency) {
      return;
    }

    const request = this.queue.shift();
    if (!request) {
      return;
    }

    // Clear timeout
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }

    const waitTime = Date.now() - request.queuedAt;
    logger.debug("Processing queued request", {
      waitTimeMs: waitTime,
      remainingInQueue: this.queue.length,
    });

    // Execute the request
    this.running++;
    request
      .fn()
      .then((result) => {
        this.completedCount++;
        request.resolve(result);
      })
      .catch((error) => {
        request.reject(error);
      })
      .finally(() => {
        this.running--;
        this.processQueue();
      });
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return {
      concurrency: this.options.maxConcurrency,
      maxConcurrency: this.options.maxConcurrency,
      running: this.running,
      queued: this.queue.length,
      completed: this.completedCount,
      timedOut: this.timedOutCount,
      rejected: this.rejectedCount,
    };
  }

  /**
   * Clear all queued requests (for cleanup)
   */
  clear(): void {
    const error = new Error("Queue cleared");
    for (const request of this.queue) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      request.reject(error);
    }
    this.queue = [];
    logger.debug("Request queue cleared");
  }

  /**
   * Wait for all pending requests to complete
   */
  async drain(): Promise<void> {
    if (this.running === 0 && this.queue.length === 0) {
      return;
    }

    return new Promise<void>((resolve) => {
      const check = () => {
        if (this.running === 0 && this.queue.length === 0) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  /**
   * Update concurrency limit
   */
  setConcurrency(maxConcurrency: number): void {
    if (maxConcurrency < 1) {
      throw new Error("maxConcurrency must be at least 1");
    }
    this.options.maxConcurrency = maxConcurrency;

    // Process queue in case we increased concurrency
    this.processQueue();
  }
}

/**
 * Error thrown when queue is full
 */
export class QueueFullError extends Error {
  constructor(
    message: string,
    public queueSize: number,
    public maxQueueSize: number
  ) {
    super(message);
    this.name = "QueueFullError";
  }
}

/**
 * Error thrown when queued request times out
 */
export class QueueTimeoutError extends Error {
  constructor(
    message: string,
    public waitTimeMs: number,
    public timeoutMs: number
  ) {
    super(message);
    this.name = "QueueTimeoutError";
  }
}

// Global request queue instance
let globalQueue: RequestQueue | null = null;

/**
 * Get or create the global request queue
 */
export function getRequestQueue(options?: QueueOptions): RequestQueue {
  if (!globalQueue) {
    globalQueue = new RequestQueue(options);
    logger.info("Request queue initialized", {
      maxConcurrency: globalQueue.getStats().maxConcurrency,
    });
  }
  return globalQueue;
}

/**
 * Close the global request queue
 */
export function closeRequestQueue(): void {
  if (globalQueue) {
    globalQueue.clear();
    globalQueue = null;
    logger.info("Request queue closed");
  }
}

/**
 * Execute a function using the global request queue
 */
export function withQueue<T>(fn: () => Promise<T>): Promise<T> {
  const queue = getRequestQueue();
  return queue.execute(fn);
}
