import { Storage } from '@google-cloud/storage';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface GCSConfig {
  projectId?: string;
  bucketName: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
  publicUrlPrefix?: string;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

export class GCSStorageClient {
  private storage: Storage;
  private bucketName: string;
  private publicUrlPrefix?: string;

  constructor(config: GCSConfig) {
    if (!config.bucketName) {
      throw new Error('GCS bucket name is required');
    }

    this.bucketName = config.bucketName;
    this.publicUrlPrefix = config.publicUrlPrefix;

    // Initialize GCS client
    const storageOptions: any = {};
    
    if (config.projectId) {
      storageOptions.projectId = config.projectId;
    }
    
    if (config.keyFilename) {
      storageOptions.keyFilename = config.keyFilename;
    } else if (config.credentials) {
      storageOptions.credentials = config.credentials;
    }
    
    this.storage = new Storage(storageOptions);
    
    logger.info('GCS client initialized', { 
      bucket: this.bucketName,
      hasKeyFile: !!config.keyFilename,
      hasCredentials: !!config.credentials,
    });
  }

  /**
   * Upload a file from local filesystem
   */
  async uploadFile(
    filePath: string,
    options: {
      key?: string;
      contentType?: string;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<UploadResult> {
    try {
      const filename = path.basename(filePath);
      const key = options.key || `attachments/${Date.now()}-${filename}`;
      
      // Get file stats
      const stats = await fs.stat(filePath);
      
      // Detect content type if not provided
      const contentType = options.contentType || this.getContentType(filename);
      
      // Upload file
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(key);
      
      await bucket.upload(filePath, {
        destination: key,
        metadata: {
          contentType,
          metadata: options.metadata,
        },
      });
      
      // Make file public if needed
      await file.makePublic();
      
      const url = this.getPublicUrl(key);
      
      logger.info('File uploaded to GCS', {
        key,
        size: stats.size,
        contentType,
      });
      
      return {
        url,
        key,
        size: stats.size,
        contentType,
      };
    } catch (error) {
      logger.error('GCS upload failed', error as Error, { filePath });
      throw new Error(`Failed to upload file to GCS: ${(error as Error).message}`);
    }
  }

  /**
   * Upload a buffer directly
   */
  async uploadBuffer(
    buffer: Buffer,
    options: {
      key: string;
      contentType?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<UploadResult> {
    try {
      const contentType = options.contentType || 'application/octet-stream';
      
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(options.key);
      
      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: options.metadata,
        },
      });
      
      // Make file public
      await file.makePublic();
      
      const url = this.getPublicUrl(options.key);
      
      logger.info('Buffer uploaded to GCS', {
        key: options.key,
        size: buffer.length,
        contentType,
      });
      
      return {
        url,
        key: options.key,
        size: buffer.length,
        contentType,
      };
    } catch (error) {
      logger.error('GCS buffer upload failed', error as Error, { key: options.key });
      throw new Error(`Failed to upload buffer to GCS: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a file from GCS
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      await bucket.file(key).delete();
      
      logger.info('File deleted from GCS', { key });
    } catch (error) {
      logger.error('GCS delete failed', error as Error, { key });
      throw new Error(`Failed to delete file from GCS: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.file(key).exists();
      return exists;
    } catch (error) {
      logger.error('GCS exists check failed', error as Error, { key });
      return false;
    }
  }

  /**
   * Get public URL for a file
   */
  private getPublicUrl(key: string): string {
    if (this.publicUrlPrefix) {
      return `${this.publicUrlPrefix}/${key}`;
    }
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }

  /**
   * Determine content type from filename
   */
  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}