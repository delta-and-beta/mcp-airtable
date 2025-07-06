import { z } from 'zod';

const ConfigSchema = z.object({
  // Required
  AIRTABLE_API_KEY: z.string().min(1, 'AIRTABLE_API_KEY is required'),
  
  // Optional with defaults
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  
  // Optional
  AIRTABLE_BASE_ID: z.string().optional(),
  MCP_AUTH_TOKEN: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_PUBLIC_URL_PREFIX: z.string().optional(),
  
  // Redis configuration
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  QUEUE_CONCURRENCY: z.string().default('5'),
  
  // Google Cloud Storage configuration
  GCS_BUCKET: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  GCS_KEY_FILE: z.string().optional(),
  GCS_CLIENT_EMAIL: z.string().optional(),
  GCS_PRIVATE_KEY: z.string().optional(),
  GCS_PUBLIC_URL_PREFIX: z.string().optional(),
  
  // Access control configuration
  ALLOWED_BASES: z.string().optional(), // Comma-separated list of base IDs
  ALLOWED_TABLES: z.string().optional(), // Comma-separated list of table names or IDs
  ALLOWED_VIEWS: z.string().optional(), // Comma-separated list of view names or IDs
  BLOCKED_BASES: z.string().optional(), // Comma-separated list of blocked base IDs
  BLOCKED_TABLES: z.string().optional(), // Comma-separated list of blocked table names
  BLOCKED_VIEWS: z.string().optional(), // Comma-separated list of blocked view names
  ACCESS_CONTROL_MODE: z.enum(['allowlist', 'blocklist', 'both']).default('allowlist'),
}).refine(
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
).refine(
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

export type Config = z.infer<typeof ConfigSchema>;

export function validateConfig(): Config {
  try {
    const config = ConfigSchema.parse(process.env);
    
    // Warn about missing auth token in production
    if (config.NODE_ENV === 'production' && !config.MCP_AUTH_TOKEN) {
      console.warn('⚠️  WARNING: MCP_AUTH_TOKEN not set in production environment');
    }
    
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.issues.forEach(issue => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

// Export a singleton config instance (lazy loaded)
let _config: Config | null = null;
export const config = new Proxy({} as Config, {
  get(_target, prop) {
    if (!_config) {
      _config = validateConfig();
    }
    return _config[prop as keyof Config];
  }
});