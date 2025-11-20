// Leaderboard Service Configuration
require('dotenv').config();

const config = {
  environment: process.env.NODE_ENV || 'development',
  
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT, 10) || 3002,
    env: process.env.NODE_ENV || 'development',
    shutdownTimeout: 30000
  },

  leaderboard: {
    maxLimit: 100,
    defaultLimit: 10,
    cacheExpiry: 300, // 5 minutes
    regions: ['NA', 'EU', 'ASIA', 'SA', 'OCE', 'GLOBAL'],
    refreshInterval: process.env.LEADERBOARD_REFRESH_INTERVAL || '*/5 * * * *', // Every 5 minutes
    snapshotTime: process.env.LEADERBOARD_SNAPSHOT_TIME || '0 0 * * *' // Daily at midnight
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'gaming_platform',
    user: process.env.DB_USER || 'postgres',
    password: null, // Will be loaded from Secrets Manager
    pool: {
      min: 2,
      max: 10
    }
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: null, // Will be loaded from Secrets Manager
    db: 0
  },

  dynamodb: {
    region: process.env.AWS_REGION || 'us-east-1',
    leaderboardTable: process.env.DYNAMODB_LEADERBOARD_TABLE || 'leaderboard'
  },

  aws: {
    region: process.env.AWS_REGION || 'eu-west-2',
    secretArn: process.env.SECRET_ARN || ''
  },

  cors: {
    allowedOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*']
  },

  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },

  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    leaderboardTTL: 300, // 5 minutes
    userPositionTTL: 60, // 1 minute
    statisticsTTL: 600 // 10 minutes
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  }
};

module.exports = config;
