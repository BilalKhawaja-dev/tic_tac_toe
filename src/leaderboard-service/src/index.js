// Leaderboard Service Main Entry Point
// Express-based API service for leaderboard and ranking functionality

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cron = require('node-cron');

const config = require('./config');
const RankingManager = require('./database/RankingManager');
const LeaderboardCache = require('./cache/LeaderboardCache');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Import routes
const leaderboardRoutes = require('./routes/leaderboard');
const healthRoutes = require('./routes/health');

class LeaderboardService {
  constructor() {
    this.app = express();
    this.rankingManager = new RankingManager();
    this.cache = new LeaderboardCache();
    this.server = null;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      logger.info('Initializing Leaderboard Service...');

      // Initialize database and cache
      await this.rankingManager.initialize();
      await this.cache.initialize();

      // Setup Express middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      // Setup scheduled jobs
      this.setupScheduledJobs();

      // Make services available to routes
      this.app.locals.rankingManager = this.rankingManager;
      this.app.locals.cache = this.cache;

      logger.info('Leaderboard Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Leaderboard Service:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());

    // CORS
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: config.cors.credentials
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use(requestLogger);

    // Trust proxy (for rate limiting behind load balancer)
    this.app.set('trust proxy', 1);
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check routes
    this.app.use('/health', healthRoutes);

    // API routes
    this.app.use('/api/leaderboard', leaderboardRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Leaderboard Service',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          leaderboard: '/api/leaderboard'
        }
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
      });
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    this.app.use(errorHandler);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown(1);
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.shutdown(0);
    });

    // Handle SIGINT
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      this.shutdown(0);
    });
  }

  /**
   * Setup scheduled jobs
   */
  setupScheduledJobs() {
    // Refresh leaderboards every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        logger.info('Running scheduled leaderboard refresh...');
        await this.rankingManager.refreshLeaderboards();
        await this.cache.invalidateAll();
        logger.info('Leaderboard refresh completed');
      } catch (error) {
        logger.error('Scheduled leaderboard refresh failed:', error);
      }
    });

    // Capture daily snapshot at midnight
    cron.schedule(config.leaderboard.snapshotTime, async () => {
      try {
        logger.info('Capturing daily leaderboard snapshot...');
        await this.rankingManager.captureSnapshot();
        logger.info('Daily snapshot captured');
      } catch (error) {
        logger.error('Daily snapshot capture failed:', error);
      }
    });

    // Clean expired cache entries every hour
    cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Cleaning expired cache entries...');
        await this.rankingManager.cleanExpiredCache();
        logger.info('Cache cleanup completed');
      } catch (error) {
        logger.error('Cache cleanup failed:', error);
      }
    });

    logger.info('Scheduled jobs configured');
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(config.server.port, config.server.host, () => {
        logger.info(`Leaderboard Service listening on ${config.server.host}:${config.server.port}`);
        logger.info(`Environment: ${config.server.env}`);
      });

      return this.server;
    } catch (error) {
      logger.error('Failed to start Leaderboard Service:', error);
      throw error;
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(exitCode = 0) {
    logger.info('Shutting down Leaderboard Service...');

    try {
      // Close server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        logger.info('HTTP server closed');
      }

      // Close database connections
      if (this.rankingManager) {
        await this.rankingManager.close();
        logger.info('Database connections closed');
      }

      // Close cache connections
      if (this.cache) {
        await this.cache.close();
        logger.info('Cache connections closed');
      }

      logger.info('Leaderboard Service shutdown complete');
      process.exit(exitCode);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the service if this file is run directly
if (require.main === module) {
  const service = new LeaderboardService();
  service.start().catch((error) => {
    logger.error('Failed to start service:', error);
    process.exit(1);
  });
}

module.exports = LeaderboardService;
