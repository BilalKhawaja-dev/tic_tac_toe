// Configuration Management
const ConfigurationManager = require('../../shared/config-manager');

const config = {
  environment: process.env.NODE_ENV || 'development',
  
  server: {
    port: parseInt(process.env.PORT) || 3000,
    shutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT) || 30000,
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 5000
  },

  cors: {
    allowedOrigins: process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',') : 
      ['http://localhost:3000', 'http://localhost:3001']
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 1000 // requests per window
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'gamedb',
    user: process.env.DB_USER || 'gameadmin',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000
  },

  dynamodb: {
    region: process.env.AWS_REGION || 'eu-west-2',
    gamesTable: process.env.DYNAMODB_GAMES_TABLE || 'global-gaming-platform-games',
    movesTable: process.env.DYNAMODB_MOVES_TABLE || 'global-gaming-platform-game-moves',
    leaderboardTable: process.env.DYNAMODB_LEADERBOARD_TABLE || 'global-gaming-platform-leaderboard',
    sessionsTable: process.env.DYNAMODB_SESSIONS_TABLE || 'global-gaming-platform-user-sessions',
    daxEndpoint: process.env.DAX_ENDPOINT || null
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'ggp:',
    connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT) || 5000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3
  },

  websocket: {
    pingInterval: parseInt(process.env.WS_PING_INTERVAL) || 30000,
    pongTimeout: parseInt(process.env.WS_PONG_TIMEOUT) || 5000,
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS) || 10000,
    messageRateLimit: parseInt(process.env.WS_MESSAGE_RATE_LIMIT) || 100, // messages per minute
    maxMessageSize: parseInt(process.env.WS_MAX_MESSAGE_SIZE) || 1024 * 10 // 10KB
  },

  game: {
    maxConcurrentGames: parseInt(process.env.MAX_CONCURRENT_GAMES) || 10000,
    gameTimeout: parseInt(process.env.GAME_TIMEOUT) || 30 * 60 * 1000, // 30 minutes
    moveTimeout: parseInt(process.env.MOVE_TIMEOUT) || 2 * 60 * 1000, // 2 minutes
    reconnectionTimeout: parseInt(process.env.RECONNECTION_TIMEOUT) || 5 * 60 * 1000, // 5 minutes
    maxSpectators: parseInt(process.env.MAX_SPECTATORS_PER_GAME) || 10
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE === 'true',
    filename: process.env.LOG_FILENAME || 'game-engine.log',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },

  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 60000,
    enableTracing: process.env.ENABLE_TRACING !== 'false',
    enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false'
  },

  security: {
    enableHelmet: process.env.ENABLE_HELMET !== 'false',
    enableCors: process.env.ENABLE_CORS !== 'false',
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000 // 24 hours
  },

  aws: {
    region: process.env.AWS_REGION || 'eu-west-2',
    secretsManager: {
      databaseSecret: process.env.DATABASE_SECRET_ARN || '',
      redisSecret: process.env.REDIS_SECRET_ARN || '',
      jwtSecret: process.env.JWT_SECRET_ARN || ''
    }
  }
};

// Initialize configuration manager for dynamic config
let configManager = null;

async function initializeConfigManager() {
  if (process.env.APPCONFIG_APPLICATION_ID && process.env.APPCONFIG_APP_SETTINGS_PROFILE_ID) {
    try {
      configManager = new ConfigurationManager({
        applicationId: process.env.APPCONFIG_APPLICATION_ID,
        environment: config.environment,
        appSettingsProfileId: process.env.APPCONFIG_APP_SETTINGS_PROFILE_ID,
        featureFlagsProfileId: process.env.APPCONFIG_FEATURE_FLAGS_PROFILE_ID
      });

      await configManager.initialize();

      // Update config with AppConfig values
      const gameSettings = configManager.getAppSetting('game', {});
      const apiSettings = configManager.getAppSetting('api', {});
      const websocketSettings = configManager.getAppSetting('websocket', {});

      // Merge AppConfig settings
      Object.assign(config.game, gameSettings);
      Object.assign(config.rateLimit, {
        max: apiSettings.rateLimitPerMinute || config.rateLimit.max,
        windowMs: 60 * 1000 // 1 minute for rate limiting
      });
      Object.assign(config.websocket, websocketSettings);

      console.log('Configuration manager initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize configuration manager:', error.message);
      console.log('Continuing with environment variables and defaults');
    }
  }
}

// Get feature flag value
function getFeatureFlag(flagName, defaultValue = false) {
  if (configManager) {
    return configManager.getFeatureFlag(flagName, defaultValue);
  }
  return process.env[`FEATURE_${flagName.toUpperCase()}`] === 'true' || defaultValue;
}

// Get application setting
function getAppSetting(settingPath, defaultValue = null) {
  if (configManager) {
    return configManager.getAppSetting(settingPath, defaultValue);
  }
  return defaultValue;
}

// Initialize config manager on module load
initializeConfigManager().catch(error => {
  console.warn('Configuration manager initialization failed:', error.message);
});

module.exports = {
  ...config,
  getFeatureFlag,
  getAppSetting,
  configManager: () => configManager
};