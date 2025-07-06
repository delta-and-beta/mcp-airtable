import Queue from 'bull';
import * as Redis from 'ioredis';
import { logger } from './logger.js';

interface QueuedOperation {
  type: 'create' | 'update' | 'delete' | 'upsert';
  tableName: string;
  baseId?: string;
  data: any;
  retryCount?: number;
  timestamp: number;
}

interface QueueConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  concurrency: number;
  rateLimit: {
    max: number;
    duration: number;
  };
}

export class QueueManager {
  private queue: Queue.Queue<QueuedOperation> | null = null;
  private redis: Redis.Redis | null = null;
  private isRedisAvailable = false;
  private localQueue: QueuedOperation[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(private config: QueueConfig) {
    this.initializeRedis();
  }

  private async initializeRedis() {
    if (!this.config.redis) {
      logger.info('Redis not configured, using in-memory queue');
      return;
    }

    try {
      this.redis = new Redis.Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
      });

      await this.redis.ping();
      
      this.queue = new Queue('airtable-operations', {
        redis: {
          host: this.config.redis.host,
          port: this.config.redis.port,
          password: this.config.redis.password,
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      this.isRedisAvailable = true;
      logger.info('Redis queue initialized successfully');
      
      // Set up queue processor
      this.setupQueueProcessor();
    } catch (error) {
      logger.warn('Failed to connect to Redis, falling back to in-memory queue', { error: (error as Error).message });
      this.isRedisAvailable = false;
      this.startLocalProcessor();
    }
  }

  private setupQueueProcessor() {
    if (!this.queue) return;

    this.queue.process(this.config.concurrency, async (job) => {
      const { data } = job;
      await this.enforceRateLimit();
      
      try {
        const result = await this.executeOperation(data);
        return result;
      } catch (error) {
        logger.error('Queue job failed', error as Error, { jobId: job.id });
        throw error;
      }
    });

    this.queue.on('completed', (job) => {
      logger.debug('Job completed', { jobId: job.id });
    });

    this.queue.on('failed', (job, err) => {
      logger.error('Job failed', err, { jobId: job.id });
    });
  }

  private startLocalProcessor() {
    if (this.processing) return;
    
    this.processing = true;
    setInterval(() => this.processLocalQueue(), 100);
  }

  private async processLocalQueue() {
    if (this.localQueue.length === 0) return;

    const now = Date.now();
    
    // Reset window if needed
    if (now - this.windowStart >= this.config.rateLimit.duration) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    // Check rate limit
    if (this.requestCount >= this.config.rateLimit.max) {
      return;
    }

    // Get next operation
    const operation = this.localQueue.shift();
    if (!operation) return;

    try {
      await this.enforceRateLimit();
      await this.executeOperation(operation);
      this.requestCount++;
    } catch (error) {
      logger.error('Local queue operation failed', error as Error, {});
      
      // Retry logic
      if (!operation.retryCount) operation.retryCount = 0;
      operation.retryCount++;
      
      if (operation.retryCount < 3) {
        // Exponential backoff
        const delay = Math.pow(2, operation.retryCount) * 1000;
        setTimeout(() => {
          this.localQueue.push(operation);
        }, delay);
      }
    }
  }

  private async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = this.config.rateLimit.duration / this.config.rateLimit.max;

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  async enqueue(operation: QueuedOperation): Promise<void> {
    operation.timestamp = Date.now();

    if (this.isRedisAvailable && this.queue) {
      await this.queue.add(operation);
      logger.debug('Operation added to Redis queue', { type: operation.type });
    } else {
      this.localQueue.push(operation);
      logger.debug('Operation added to local queue', { type: operation.type });
    }
  }

  async enqueueBatch(operations: QueuedOperation[]): Promise<void> {
    if (this.isRedisAvailable && this.queue) {
      const jobs = operations.map(op => ({
        data: { ...op, timestamp: Date.now() },
      }));
      
      await this.queue.addBulk(jobs);
      logger.debug('Batch operations added to Redis queue', { count: operations.length });
    } else {
      operations.forEach(op => {
        this.localQueue.push({ ...op, timestamp: Date.now() });
      });
      logger.debug('Batch operations added to local queue', { count: operations.length });
    }
  }

  private async executeOperation(operation: QueuedOperation): Promise<any> {
    logger.debug('Executing operation', { type: operation.type });
    
    // Store the callback reference to resolve/reject the promise
    const callback = (operation as any).callback;
    
    try {
      let result: any;
      
      // Import client dynamically to avoid circular dependencies
      const { AirtableClient } = await import('../airtable/client.js');
      const client = new AirtableClient({
        apiKey: process.env.AIRTABLE_API_KEY || '',
        baseId: operation.baseId || process.env.AIRTABLE_BASE_ID,
      });
      
      switch (operation.type) {
        case 'create':
          result = await client.batchCreate(
            operation.tableName,
            operation.data.records,
            operation.data.options
          );
          break;
          
        case 'update':
          result = await client.batchUpdate(
            operation.tableName,
            operation.data.records,
            operation.data.options
          );
          break;
          
        case 'upsert':
          result = await client.batchUpsert(
            operation.tableName,
            operation.data.records,
            operation.data.options
          );
          break;
          
        case 'delete':
          // Handle batch delete operation
          if (operation.data.recordIds) {
            result = await client.batchDelete(
              operation.tableName,
              operation.data.recordIds,
              { baseId: operation.baseId }
            );
          } else {
            // Handle single delete operation (backwards compatibility)
            result = await client.deleteRecord(
              operation.tableName,
              operation.data.recordId,
              { baseId: operation.baseId }
            );
          }
          break;
          
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
      
      if (callback) {
        callback.resolve(result);
      }
      
      return result;
    } catch (error) {
      logger.error('Operation execution failed', error as Error, { operationType: operation.type });
      
      if (callback) {
        callback.reject(error);
      }
      
      throw error;
    }
  }

  async getQueueSize(): Promise<number> {
    if (this.isRedisAvailable && this.queue) {
      const counts = await this.queue.getJobCounts();
      return counts.waiting + counts.active + counts.delayed;
    }
    return this.localQueue.length;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down queue manager');
    
    if (this.queue) {
      await this.queue.close();
    }
    
    if (this.redis) {
      this.redis.disconnect();
    }
    
    this.processing = false;
  }
}

// Create singleton instance
export const queueManager = new QueueManager({
  redis: process.env.REDIS_URL || process.env.REDIS_HOST ? {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  } : undefined,
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
  rateLimit: {
    max: 5, // Airtable limit
    duration: 1000, // per second
  },
});