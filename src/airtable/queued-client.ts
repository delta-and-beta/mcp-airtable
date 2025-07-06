import { AirtableClient } from './client.js';
import { queueManager } from '../utils/queue-manager.js';
import { airtableRateLimiter } from '../utils/enhanced-rate-limiter.js';
import { logger } from '../utils/logger.js';
import type { FieldSet } from 'airtable';

export class QueuedAirtableClient extends AirtableClient {
  private useQueue: boolean;

  constructor(config: { apiKey: string; baseId?: string; useQueue?: boolean }) {
    super(config);
    this.useQueue = config.useQueue ?? true;
  }

  /**
   * Smart create that auto-batches when records > 10
   */
  async smartCreate(
    tableName: string,
    records: FieldSet | FieldSet[],
    options: { baseId?: string; typecast?: boolean } = {}
  ) {
    const recordArray = Array.isArray(records) ? records : [records];
    
    if (recordArray.length > 10) {
      logger.info('Auto-batching create operation', { count: recordArray.length });
      return this.batchCreate(
        tableName,
        recordArray.map(fields => ({ fields })),
        options
      );
    }

    // Single or small batch - use regular create with rate limiting
    return airtableRateLimiter.executeWithRetry(async () => {
      if (recordArray.length === 1) {
        return [await this.createRecord(tableName, recordArray[0], options)];
      } else {
        return this.batchCreate(
          tableName,
          recordArray.map(fields => ({ fields })),
          options
        );
      }
    }, { baseId: options.baseId, operation: 'create' });
  }

  /**
   * Smart update that auto-batches when records > 10
   */
  async smartUpdate(
    tableName: string,
    updates: { id: string; fields: FieldSet } | Array<{ id: string; fields: FieldSet }>,
    options: { baseId?: string; typecast?: boolean } = {}
  ) {
    const updateArray = Array.isArray(updates) ? updates : [updates];
    
    if (updateArray.length > 10) {
      logger.info('Auto-batching update operation', { count: updateArray.length });
      return this.batchUpdate(tableName, updateArray, options);
    }

    // Single or small batch - use regular update with rate limiting
    return airtableRateLimiter.executeWithRetry(async () => {
      if (updateArray.length === 1) {
        const { id, fields } = updateArray[0];
        return [await this.updateRecord(tableName, id, fields, options)];
      } else {
        return this.batchUpdate(tableName, updateArray, options);
      }
    }, { baseId: options.baseId, operation: 'update' });
  }

  /**
   * Enhanced batch create with queue support
   */
  async batchCreate(
    tableName: string,
    records: Array<{ fields: FieldSet }>,
    options: {
      baseId?: string;
      typecast?: boolean;
    } = {}
  ) {
    if (!this.useQueue) {
      return airtableRateLimiter.executeWithRetry(
        () => super.batchCreate(tableName, records, options),
        { baseId: options.baseId, operation: 'batchCreate' }
      );
    }

    // Queue operations in chunks
    const chunks = [];
    for (let i = 0; i < records.length; i += 10) {
      chunks.push(records.slice(i, i + 10));
    }

    const results: any[] = [];
    const promises = chunks.map((chunk, index) => 
      this.queueOperation({
        type: 'create',
        tableName,
        baseId: options.baseId,
        data: {
          records: chunk,
          options,
        },
        priority: chunks.length - index, // Earlier chunks have higher priority
      })
    );

    const chunkResults = await Promise.all(promises);
    chunkResults.forEach(result => results.push(...result));
    
    return results;
  }

  /**
   * Enhanced batch update with queue support
   */
  async batchUpdate(
    tableName: string,
    records: Array<{ id: string; fields: FieldSet }>,
    options: {
      baseId?: string;
      typecast?: boolean;
    } = {}
  ) {
    if (!this.useQueue) {
      return airtableRateLimiter.executeWithRetry(
        () => super.batchUpdate(tableName, records, options),
        { baseId: options.baseId, operation: 'batchUpdate' }
      );
    }

    // Queue operations in chunks
    const chunks = [];
    for (let i = 0; i < records.length; i += 10) {
      chunks.push(records.slice(i, i + 10));
    }

    const results: any[] = [];
    const promises = chunks.map((chunk, index) => 
      this.queueOperation({
        type: 'update',
        tableName,
        baseId: options.baseId,
        data: {
          records: chunk,
          options,
        },
        priority: chunks.length - index,
      })
    );

    const chunkResults = await Promise.all(promises);
    chunkResults.forEach(result => results.push(...result));
    
    return results;
  }

  private async queueOperation(operation: {
    type: 'create' | 'update' | 'delete' | 'upsert';
    tableName: string;
    baseId?: string;
    data: any;
    priority?: number;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      // Store resolve/reject callbacks with operation
      const enhancedOp = {
        ...operation,
        timestamp: Date.now(),
        callback: { resolve, reject },
      };

      queueManager.enqueue(enhancedOp as any).catch(reject);
    });
  }

  /**
   * Enhanced batch delete with queue support
   */
  async batchDelete(
    tableName: string,
    recordIds: string[],
    options: {
      baseId?: string;
    } = {}
  ) {
    if (!this.useQueue || recordIds.length <= 10) {
      return airtableRateLimiter.executeWithRetry(
        () => super.batchDelete(tableName, recordIds, options),
        { baseId: options.baseId, operation: 'batchDelete' }
      );
    }

    // Queue operations in chunks
    const chunks = [];
    for (let i = 0; i < recordIds.length; i += 10) {
      chunks.push(recordIds.slice(i, i + 10));
    }

    const results: any[] = [];
    const promises = chunks.map((chunk, index) => 
      this.queueOperation({
        type: 'delete',
        tableName,
        baseId: options.baseId,
        data: {
          recordIds: chunk,
        },
        priority: chunks.length - index,
      })
    );

    const chunkResults = await Promise.all(promises);
    chunkResults.forEach(result => results.push(...result));
    
    return results;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const queueSize = await queueManager.getQueueSize();
    const rateLimitStats = airtableRateLimiter.getStats();
    
    return {
      queueSize,
      rateLimit: rateLimitStats,
      useQueue: this.useQueue,
    };
  }
}