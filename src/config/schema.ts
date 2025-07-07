import { z } from 'zod';

/**
 * Configuration schema for the MCP Airtable server.
 * Uses Zod for runtime validation and type inference.
 */

// Server configuration schema
const ServerConfigSchema = z.object({
  PORT: z.string().default('3000').describe('HTTP server port'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  CORS_ORIGIN: z.string().default('*').describe('CORS allowed origins'),
});

// Airtable configuration schema
const AirtableConfigSchema = z.object({
  AIRTABLE_API_KEY: z.string().min(1, 'AIRTABLE_API_KEY is required'),
  AIRTABLE_BASE_ID: z.string().optional().describe('Default Airtable base ID'),
});

// Authentication configuration schema
const AuthConfigSchema = z.object({
  MCP_AUTH_TOKEN: z.string().optional().describe('Bearer token for API authentication'),
});

// AWS S3 configuration schema
const S3ConfigSchema = z.object({
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_PUBLIC_URL_PREFIX: z.string().optional().describe('Custom domain for S3 URLs'),
});

// Google Cloud Storage configuration schema
const GCSConfigSchema = z.object({
  GCS_BUCKET: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  GCS_KEY_FILE: z.string().optional().describe('Path to GCS service account key file'),
  GCS_CLIENT_EMAIL: z.string().optional(),
  GCS_PRIVATE_KEY: z.string().optional(),
  GCS_PUBLIC_URL_PREFIX: z.string().optional().describe('Custom domain for GCS URLs'),
});

// Redis configuration schema (for rate limiting and queuing)
const RedisConfigSchema = z.object({
  REDIS_URL: z.string().optional().describe('Redis connection URL'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  QUEUE_CONCURRENCY: z.string().default('5').describe('Max concurrent queue jobs'),
});

// Access control configuration schema
const AccessControlSchema = z.object({
  ALLOWED_BASES: z.string().optional().describe('Comma-separated list of allowed base IDs'),
  ALLOWED_TABLES: z.string().optional().describe('Comma-separated list of allowed tables'),
  ALLOWED_VIEWS: z.string().optional().describe('Comma-separated list of allowed views'),
  BLOCKED_BASES: z.string().optional().describe('Comma-separated list of blocked base IDs'),
  BLOCKED_TABLES: z.string().optional().describe('Comma-separated list of blocked tables'),
  BLOCKED_VIEWS: z.string().optional().describe('Comma-separated list of blocked views'),
  ACCESS_CONTROL_MODE: z.enum(['allowlist', 'blocklist', 'both']).default('allowlist'),
});

// Rate limiting configuration schema
const RateLimitSchema = z.object({
  RATE_LIMIT_ENABLED: z.string().default('true').transform(v => v === 'true'),
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.string().default('60').transform(Number),
  RATE_LIMIT_BURST: z.string().default('10').transform(Number),
});

// Logging configuration schema
const LoggingSchema = z.object({
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

// Complete configuration schema
export const ConfigSchema = ServerConfigSchema
  .merge(AirtableConfigSchema)
  .merge(AuthConfigSchema)
  .merge(S3ConfigSchema)
  .merge(GCSConfigSchema)
  .merge(RedisConfigSchema)
  .merge(AccessControlSchema)
  .merge(RateLimitSchema)
  .merge(LoggingSchema)
  .refine(
    (config) => {
      // If S3 bucket is provided, AWS credentials must be provided
      if (config.AWS_S3_BUCKET) {
        return config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY;
      }
      return true;
    },
    {
      message: 'AWS credentials are required when AWS_S3_BUCKET is set',
    }
  )
  .refine(
    (config) => {
      // If GCS bucket is provided, either key file or credentials must be provided
      if (config.GCS_BUCKET) {
        return config.GCS_KEY_FILE || (config.GCS_CLIENT_EMAIL && config.GCS_PRIVATE_KEY);
      }
      return true;
    },
    {
      message: 'GCS credentials (key file or client email/private key) are required when GCS_BUCKET is set',
    }
  );

// Export the inferred type
export type Config = z.infer<typeof ConfigSchema>;