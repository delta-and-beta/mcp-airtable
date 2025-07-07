import { z } from 'zod';
import { ConfigSchema, type Config } from './schema.js';

/**
 * Configuration module for the MCP Airtable server.
 * Provides validated configuration with type safety.
 */

/**
 * Validates the configuration from environment variables.
 * Exits the process if validation fails.
 */
export function validateConfig(): Config {
  try {
    // Log environment variables for debugging (redact sensitive values)
    console.log('🔍 Environment check:');
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
    console.log(`  - PORT: ${process.env.PORT || '(not set)'}`);
    console.log(`  - AIRTABLE_API_KEY: ${process.env.AIRTABLE_API_KEY ? '***' + process.env.AIRTABLE_API_KEY.slice(-4) : '(not set)'}`);
    console.log(`  - AIRTABLE_BASE_ID: ${process.env.AIRTABLE_BASE_ID || '(not set)'}`);
    console.log(`  - MCP_AUTH_TOKEN: ${process.env.MCP_AUTH_TOKEN ? '***' + process.env.MCP_AUTH_TOKEN.slice(-4) : '(not set)'}`);
    
    const config = ConfigSchema.parse(process.env);
    
    // Warn about missing auth token in production
    if (config.NODE_ENV === 'production' && !config.MCP_AUTH_TOKEN) {
      console.warn('⚠️  WARNING: MCP_AUTH_TOKEN not set in production environment');
    }
    
    // Log configuration summary
    console.log('✅ Configuration validated successfully');
    if (config.NODE_ENV === 'development') {
      console.log('📋 Configuration loaded:');
      console.log(`  - Environment: ${config.NODE_ENV}`);
      console.log(`  - Port: ${config.PORT}`);
      console.log(`  - Airtable Base: ${config.AIRTABLE_BASE_ID || '(not set - will be required per request)'}`);
      console.log(`  - Authentication: ${config.MCP_AUTH_TOKEN ? 'enabled' : 'disabled'}`);
      console.log(`  - Storage: ${getStorageInfo(config)}`);
      console.log(`  - Rate limiting: ${config.RATE_LIMIT_ENABLED ? 'enabled' : 'disabled'}`);
    }
    
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.issues.forEach(issue => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      console.error('\n💡 Please check your environment variables and .env file');
      console.error('📌 Current environment variables:');
      console.error(`  - AIRTABLE_API_KEY: ${process.env.AIRTABLE_API_KEY ? 'set' : 'NOT SET'}`);
      console.error(`  - NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Get storage configuration info for logging
 */
function getStorageInfo(config: Config): string {
  const storage = [];
  if (config.AWS_S3_BUCKET) storage.push('S3');
  if (config.GCS_BUCKET) storage.push('GCS');
  return storage.length > 0 ? storage.join(', ') : 'none';
}

/**
 * Singleton configuration instance.
 * Lazy-loaded on first access for better performance.
 */
let _config: Config | null = null;

export const config = new Proxy({} as Config, {
  get(_target, prop) {
    if (!_config) {
      _config = validateConfig();
    }
    return _config[prop as keyof Config];
  }
});

/**
 * Re-export types for convenience
 */
export type { Config } from './schema.js';

/**
 * Helper function to get parsed list from comma-separated environment variable
 */
export function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Configuration helper functions
 */
export const configHelpers = {
  isProduction: () => config.NODE_ENV === 'production',
  isDevelopment: () => config.NODE_ENV === 'development',
  isTest: () => config.NODE_ENV === 'test',
  
  hasS3: () => !!config.AWS_S3_BUCKET,
  hasGCS: () => !!config.GCS_BUCKET,
  hasStorage: () => configHelpers.hasS3() || configHelpers.hasGCS(),
  
  hasRedis: () => !!config.REDIS_URL || config.REDIS_HOST !== 'localhost',
  hasAuth: () => !!config.MCP_AUTH_TOKEN,
  
  getAllowedBases: () => parseList(config.ALLOWED_BASES),
  getAllowedTables: () => parseList(config.ALLOWED_TABLES),
  getAllowedViews: () => parseList(config.ALLOWED_VIEWS),
  getBlockedBases: () => parseList(config.BLOCKED_BASES),
  getBlockedTables: () => parseList(config.BLOCKED_TABLES),
  getBlockedViews: () => parseList(config.BLOCKED_VIEWS),
};