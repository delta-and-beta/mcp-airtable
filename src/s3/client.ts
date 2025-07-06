import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { basename } from 'path';
import { lookup } from 'mime-types';

export interface S3Config {
  region: string;
  bucketName: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrlPrefix?: string;
}

export class S3StorageClient {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrlPrefix?: string;

  constructor(config: S3Config) {
    if (!config.bucketName) {
      throw new Error('S3 bucket name is required');
    }

    this.s3Client = new S3Client({
      region: config.region || 'us-east-1',
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    });

    this.bucketName = config.bucketName;
    this.publicUrlPrefix = config.publicUrlPrefix;
  }

  async uploadFile(filePath: string, options: {
    key?: string;
    contentType?: string;
    metadata?: Record<string, string>;
  } = {}): Promise<{
    url: string;
    key: string;
    size: number;
    contentType: string;
  }> {
    try {
      const stats = await stat(filePath);
      const filename = basename(filePath);
      const key = options.key || `attachments/${Date.now()}-${filename}`;
      const contentType = options.contentType || lookup(filePath) || 'application/octet-stream';

      const fileStream = createReadStream(filePath);

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: fileStream,
          ContentType: contentType,
          Metadata: options.metadata,
        },
      });

      await upload.done();

      const url = this.publicUrlPrefix
        ? `${this.publicUrlPrefix}/${key}`
        : `https://${this.bucketName}.s3.amazonaws.com/${key}`;

      return {
        url,
        key,
        size: stats.size,
        contentType,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upload file: ${error.message}`);
      }
      throw error;
    }
  }

  async uploadBuffer(buffer: Buffer, options: {
    key: string;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<{
    url: string;
    key: string;
    size: number;
    contentType: string;
  }> {
    try {
      const contentType = options.contentType || 'application/octet-stream';

      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        Body: buffer,
        ContentType: contentType,
        Metadata: options.metadata,
      }));

      const url = this.publicUrlPrefix
        ? `${this.publicUrlPrefix}/${options.key}`
        : `https://${this.bucketName}.s3.amazonaws.com/${options.key}`;

      return {
        url,
        key: options.key,
        size: buffer.length,
        contentType,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upload buffer: ${error.message}`);
      }
      throw error;
    }
  }
}