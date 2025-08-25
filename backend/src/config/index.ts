import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  storageBasePath: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  crawler: {
    maxDepth: number;
    maxPages: number;
    timeout: number;
    respectRobots: boolean;
  };
  maxConcurrentArchives: number;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  storageBasePath: process.env.STORAGE_BASE_PATH || 'archives',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  crawler: {
    maxDepth: parseInt(process.env.CRAWLER_MAX_DEPTH || '2', 10),
    maxPages: parseInt(process.env.CRAWLER_MAX_PAGES || '50', 10),
    timeout: parseInt(process.env.CRAWLER_TIMEOUT || '15000', 10),
    respectRobots: process.env.CRAWLER_RESPECT_ROBOTS === 'true',
  },
  maxConcurrentArchives: parseInt(process.env.MAX_CONCURRENT_ARCHIVES || '3', 10),
};

export default config;