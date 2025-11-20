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
      logger.info('Initializing database...');
      await this.rankingManager.initialize();
      logger.info('Initializing cache...');
      await this.cache.initialize();

      // Setup Express middleware
      logger.info('Setting up middleware...');
      this.setupMiddleware();

      // Setup routes
      logger.info('Setting up routes...');
      this.setupRoutes();

      // Setup error handling
      logger.info('Setting up error handling...');
      this.setupErrorHandling();

      // Setup scheduled jobs
      logger.info('Setting up scheduled jobs...');
      this.setupScheduledJobs();

      // Make services available to routes
      this.app.locals.rankingManager = this.rankingManager;
      this.app.locals.cache = this.cache;

      logger.info('Leaderboard Service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Leaderboard Service:', error);
      console.error('Failed to initialize Leaderboard Service:', error);
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
    // Simple root endpoint for ALB health checks (no async operations)
    this.app.get('/', (req, res) => {
      res.status(200).json({ status: 'ok', service: 'leaderboard' });
    });

    // Simple health endpoint for container health check (no async operations)
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok', service: 'leaderboard' });
    });

    // Simple working endpoints
    this.app.get('/api/leaderboard/test', (req, res) => {
      res.status(200).json({ status: 'ok', message: 'Leaderboard routing works!' });
    });

    this.app.get('/api/leaderboard/global', async (req, res) => {
      try {
        const { rankingManager } = this.app.locals;
        const leaderboard = await rankingManager.getGlobalLeaderboard(100, 0);
        res.json({ success: true, data: leaderboard });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/leaderboard/statistics', async (req, res) => {
      try {
        const { rankingManager } = this.app.locals;
        const stats = await rankingManager.getLeaderboardStatistics();
        res.json({ success: true, data: stats });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Health check with detailed async operations
    this.app.use('/api/leaderboard/health', healthRoutes);
    
    // General API routes - DISABLED for now to avoid conflicts
    // this.app.use('/api/leaderboard', leaderboardRoutes);

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
      logger.info('Starting server initialization...');
      await this.initialize();
      logger.info('Initialization complete, starting HTTP server...');

      const port = config.server.port;
      const host = config.server.host;
      
      logger.info(`Attempting to listen on ${host}:${port}`);

      this.server = this.app.listen(port, host, () => {
        console.log(`Leaderboard Service listening on ${host}:${port}`);
        logger.info(`Leaderboard Service listening on ${host}:${port}`);
        logger.info(`Environment: ${config.server.env}`);
      });

      this.server.on('error', (error) => {
        logger.error('Server error:', error);
        console.error('Server error:', error);
      });

      logger.info('Server listen() called, waiting for callback...');

      return this.server;
    } catch (error) {
      logger.error('Failed to start Leaderboard Service:', error);
      console.error('Failed to start Leaderboard Service:', error);
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
