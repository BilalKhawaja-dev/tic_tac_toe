// Game Engine Service - Main Entry Point
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const config = require('./config');
const GameEngine = require('./game/GameEngine');
const WebSocketManager = require('./websocket/WebSocketManager');
const DatabaseManager = require('./database/DatabaseManager');
const CacheManager = require('./cache/CacheManager');
const healthRoutes = require('./routes/health');
const gameRoutes = require('./routes/game');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

class GameEngineServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.gameEngine = null;
    this.wsManager = null;
    this.dbManager = null;
    this.cacheManager = null;
    
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      logger.info('Initializing Game Engine Server...');

      // Initialize database connection
      this.dbManager = new DatabaseManager();
      await this.dbManager.initialize();
      logger.info('Database connection established');

      // Initialize cache connection
      this.cacheManager = new CacheManager();
      await this.cacheManager.initialize();
      logger.info('Cache connection established');

      // Initialize game engine
      this.gameEngine = new GameEngine(this.dbManager, this.cacheManager);
      logger.info('Game engine initialized');

      // Initialize WebSocket manager
      this.wsManager = new WebSocketManager(this.wss, this.gameEngine);
      this.wsManager.initialize();
      logger.info('WebSocket manager initialized');

      // Setup Express middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Game Engine Server initialization completed');
    } catch (error) {
      logger.error('Failed to initialize Game Engine Server:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "wss:", "ws:"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.cors.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);
  }

  setupRoutes() {
    // Health check routes - both at root and under /api/game for ALB
    this.app.use('/health', healthRoutes);
    this.app.use('/api/game/health', healthRoutes);

    // Game API routes
    this.app.use('/api/game', gameRoutes(this.gameEngine));

    // WebSocket info endpoint
    this.app.get('/api/websocket/info', (req, res) => {
      res.json({
        endpoint: `ws://${req.get('host')}/`,
        protocol: 'ws',
        connections: this.wsManager ? this.wsManager.getConnectionCount() : 0,
        activeGames: this.gameEngine ? this.gameEngine.getActiveGameCount() : 0
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Game Engine Service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.environment
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('SIGTERM');
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });
  }

  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        this.gracefulShutdown(signal);
      });
    });
  }

  async gracefulShutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal:', signal);
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown...');

    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, config.server.shutdownTimeout);

    try {
      // Stop accepting new connections
      this.server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close WebSocket connections gracefully
      if (this.wsManager) {
        await this.wsManager.shutdown();
        logger.info('WebSocket connections closed');
      }

      // Close database connections
      if (this.dbManager) {
        await this.dbManager.close();
        logger.info('Database connections closed');
      }

      // Close cache connections
      if (this.cacheManager) {
        await this.cacheManager.close();
        logger.info('Cache connections closed');
      }

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  }

  async start() {
    try {
      await this.initialize();

      const port = config.server.port;
      this.server.listen(port, () => {
        logger.info(`Game Engine Server listening on port ${port}`);
        logger.info(`Environment: ${config.environment}`);
        logger.info(`WebSocket endpoint: ws://localhost:${port}/`);
        logger.info(`Health check: http://localhost:${port}/health`);
      });

      return this.server;
    } catch (error) {
      logger.error('Failed to start Game Engine Server:', error);
      throw error;
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new GameEngineServer();
  server.start().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = GameEngineServer;