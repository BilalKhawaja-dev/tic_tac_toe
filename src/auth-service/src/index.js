// Authentication Service - Main Entry Point
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const config = require('./config');
const DatabaseManager = require('./database/DatabaseManager');
const CacheManager = require('./cache/CacheManager');
const CognitoService = require('./services/CognitoService');
const JWTService = require('./services/JWTService');
const UserService = require('./services/UserService');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const healthRoutes = require('./routes/health');

// Middleware imports
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');
const { authenticateToken } = require('./middleware/auth');

class AuthenticationServer {
  constructor() {
    this.app = express();
    this.server = null;
    
    this.dbManager = null;
    this.cacheManager = null;
    this.cognitoService = null;
    this.jwtService = null;
    this.userService = null;
    
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      logger.info('Initializing Authentication Server...');

      // Initialize database connection
      this.dbManager = new DatabaseManager();
      await this.dbManager.initialize();
      logger.info('Database connection established');

      // Initialize cache connection
      this.cacheManager = new CacheManager();
      await this.cacheManager.initialize();
      logger.info('Cache connection established');

      // Initialize services
      this.cognitoService = new CognitoService();
      this.jwtService = new JWTService();
      this.userService = new UserService(this.dbManager, this.cacheManager);

      // Setup Express middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Authentication Server initialization completed');
    } catch (error) {
      logger.error('Failed to initialize Authentication Server:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "https://*.amazonaws.com", "https://*.google.com", "https://*.facebook.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
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

    // Cookie parser
    this.app.use(cookieParser(config.session.secret));

    // Session configuration
    this.app.use(session({
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.environment === 'production',
        httpOnly: true,
        maxAge: config.session.maxAge
      }
    }));

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

    // Make services available to routes
    this.app.locals.services = {
      cognito: this.cognitoService,
      jwt: this.jwtService,
      user: this.userService,
      db: this.dbManager,
      cache: this.cacheManager
    };
  }

  setupRoutes() {
    // Health check routes
    this.app.use('/health', healthRoutes);

    // Authentication routes
    this.app.use('/api/auth', authRoutes);

    // User management routes (protected)
    this.app.use('/api/user', authenticateToken, userRoutes);

    // OAuth callback routes
    this.app.get('/auth/google/callback', async (req, res) => {
      try {
        // Handle Google OAuth callback
        const result = await this.cognitoService.handleOAuthCallback('google', req.query);
        res.redirect(`${config.frontend.baseUrl}/auth/success?token=${result.accessToken}`);
      } catch (error) {
        logger.error('Google OAuth callback error:', error);
        res.redirect(`${config.frontend.baseUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
      }
    });

    this.app.get('/auth/facebook/callback', async (req, res) => {
      try {
        // Handle Facebook OAuth callback
        const result = await this.cognitoService.handleOAuthCallback('facebook', req.query);
        res.redirect(`${config.frontend.baseUrl}/auth/success?token=${result.accessToken}`);
      } catch (error) {
        logger.error('Facebook OAuth callback error:', error);
        res.redirect(`${config.frontend.baseUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
      }
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Authentication Service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.environment,
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          user: '/api/user'
        }
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
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
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
      this.server = this.app.listen(port, () => {
        logger.info(`Authentication Server listening on port ${port}`);
        logger.info(`Environment: ${config.environment}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`API documentation: http://localhost:${port}/api/docs`);
      });

      return this.server;
    } catch (error) {
      logger.error('Failed to start Authentication Server:', error);
      throw error;
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new AuthenticationServer();
  server.start().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = AuthenticationServer;