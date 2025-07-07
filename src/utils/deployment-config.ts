/**
 * Deployment configuration loader
 * Allows environment-specific configurations without changing core code
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface DeploymentConfig {
  deployment: {
    name: string;
    type: 'container' | 'serverless' | 'edge' | 'local';
    region?: string;
  };
  features: {
    redis: boolean;
    s3: boolean;
    gcs: boolean;
    queue: boolean;
  };
  limits: {
    maxRequestSize?: number;
    maxBatchSize?: number;
    rateLimitPerSecond?: number;
  };
  storage?: {
    type: 's3' | 'gcs' | 'local';
    bucket?: string;
    prefix?: string;
  };
}

const DEFAULT_CONFIG: DeploymentConfig = {
  deployment: {
    name: 'local',
    type: 'local',
  },
  features: {
    redis: false,
    s3: false,
    gcs: false,
    queue: false,
  },
  limits: {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    maxBatchSize: 10,
    rateLimitPerSecond: 5,
  },
};

let cachedConfig: DeploymentConfig | null = null;

export function loadDeploymentConfig(): DeploymentConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Check for deployment-specific config
  const deploymentName = process.env.DEPLOYMENT_NAME || 'local';
  const configPaths = [
    join(process.cwd(), `deploy/${deploymentName}/config.json`),
    join(process.cwd(), 'deploy/config.json'),
    join(process.cwd(), 'deployment.config.json'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const configContent = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent) as DeploymentConfig;
        cachedConfig = { ...DEFAULT_CONFIG, ...config };
        console.log(`Loaded deployment config from: ${configPath}`);
        return cachedConfig;
      } catch (error) {
        console.error(`Failed to load config from ${configPath}:`, error);
      }
    }
  }

  // Use environment variables to override defaults
  cachedConfig = {
    ...DEFAULT_CONFIG,
    deployment: {
      ...DEFAULT_CONFIG.deployment,
      name: process.env.DEPLOYMENT_NAME || DEFAULT_CONFIG.deployment.name,
    },
    features: {
      redis: process.env.REDIS_URL || process.env.REDIS_HOST ? true : false,
      s3: process.env.AWS_S3_BUCKET ? true : false,
      gcs: process.env.GCS_BUCKET ? true : false,
      queue: process.env.ENABLE_QUEUE === 'true',
    },
    limits: {
      maxRequestSize: process.env.MAX_REQUEST_SIZE 
        ? parseInt(process.env.MAX_REQUEST_SIZE) 
        : DEFAULT_CONFIG.limits.maxRequestSize,
      maxBatchSize: process.env.MAX_BATCH_SIZE 
        ? parseInt(process.env.MAX_BATCH_SIZE) 
        : DEFAULT_CONFIG.limits.maxBatchSize,
      rateLimitPerSecond: process.env.RATE_LIMIT_PER_SECOND 
        ? parseInt(process.env.RATE_LIMIT_PER_SECOND) 
        : DEFAULT_CONFIG.limits.rateLimitPerSecond,
    },
  };

  return cachedConfig;
}

export function isFeatureEnabled(feature: keyof DeploymentConfig['features']): boolean {
  const config = loadDeploymentConfig();
  return config.features[feature] || false;
}

export function getDeploymentType(): DeploymentConfig['deployment']['type'] {
  const config = loadDeploymentConfig();
  return config.deployment.type;
}