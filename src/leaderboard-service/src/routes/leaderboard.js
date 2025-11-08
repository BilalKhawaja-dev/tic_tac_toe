// Leaderboard API Routes
// Handles all leaderboard-related endpoints

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const config = require('../config');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

// Rate limiter
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  skip: () => !config.rateLimit.enabled
});

// Apply rate limiting to all routes
router.use(limiter);

/**
 * Validation schemas
 */
const schemas = {
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(config.leaderboard.maxLimit).default(config.leaderboard.defaultLimit),
    offset: Joi.number().integer().min(0).default(0)
  }),
  userId: Joi.object({
    userId: Joi.string().uuid().required()
  }),
  region: Joi.object({
    region: Joi.string().valid(...config.leaderboard.regions).required()
  }),
  search: Joi.object({
    q: Joi.string().min(2).max(50).required()
  }),
  metric: Joi.object({
    metric: Joi.string().valid('win_rate', 'streak', 'wins', 'games').required(),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }),
  comparison: Joi.object({
    userId1: Joi.string().uuid().required(),
    userId2: Joi.string().uuid().required()
  }),
  history: Joi.object({
    userId: Joi.string().uuid().required(),
    days: Joi.number().integer().min(1).max(365).default(30)
  })
};

/**
 * Validate request parameters
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(
      { ...req.params, ...req.query, ...req.body },
      { abortEarly: false }
    );

    if (error) {
      throw new ValidationError(error.message);
    }

    req.validated = value;
    next();
  };
}

/**
 * Cache middleware
 */
function cacheMiddleware(cacheKey, ttl = null) {
  return async (req, res, next) => {
    if (!config.cache.enabled) {
      return next();
    }

    try {
      const { cache } = req.app.locals;
      const key = typeof cacheKey === 'function' ? cacheKey(req) : cacheKey;
      
      const cachedData = await cache.get(key);
      
      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          cache.set(key, data.data, ttl).catch(err => {
            console.error('Cache set error:', err);
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      // Continue without cache on error
      next();
    }
  };
}

/**
 * GET /api/leaderboard/global
 * Get global leaderboard with pagination
 */
router.get(
  '/global',
  validate(schemas.pagination),
  cacheMiddleware(
    req => `global:${req.validated.limit}:${req.validated.offset}`,
    config.cache.leaderboardTTL
  ),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const { limit, offset } = req.validated;

      const leaderboard = await rankingManager.getGlobalLeaderboard(limit, offset);

      res.json({
        success: true,
        data: {
          leaderboard,
          pagination: {
            limit,
            offset,
            count: leaderboard.length
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/regional/:region
 * Get regional leaderboard
 */
router.get(
  '/regional/:region',
  validate(schemas.region),
  validate(schemas.pagination),
  cacheMiddleware(
    req => `regional:${req.validated.region}:${req.validated.limit}:${req.validated.offset}`,
    config.cache.leaderboardTTL
  ),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const { region, limit, offset } = req.validated;

      const leaderboard = await rankingManager.getRegionalLeaderboard(region, limit, offset);

      res.json({
        success: true,
        data: {
          region,
          leaderboard,
          pagination: {
            limit,
            offset,
            count: leaderboard.length
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/regions
 * Get all regions with player counts
 */
router.get(
  '/regions',
  cacheMiddleware('regions', config.cache.statisticsTTL),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;

      const regions = await rankingManager.getRegions();

      res.json({
        success: true,
        data: { regions },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/user/:userId
 * Get user's leaderboard position
 */
router.get(
  '/user/:userId',
  validate(schemas.userId),
  cacheMiddleware(
    req => `user:${req.validated.userId}:position`,
    config.cache.userPositionTTL
  ),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const { userId } = req.validated;

      const position = await rankingManager.getUserPosition(userId);

      if (!position) {
        throw new NotFoundError('User not found in leaderboard');
      }

      res.json({
        success: true,
        data: position,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/around/:rank
 * Get players around a specific rank
 */
router.get(
  '/around/:rank',
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const rank = parseInt(req.params.rank);
      const range = parseInt(req.query.range) || 10;

      if (isNaN(rank) || rank < 1) {
        throw new ValidationError('Invalid rank parameter');
      }

      const players = await rankingManager.getPlayersAroundRank(rank, range);

      res.json({
        success: true,
        data: {
          centerRank: rank,
          range,
          players
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/statistics
 * Get overall leaderboard statistics
 */
router.get(
  '/statistics',
  cacheMiddleware('statistics', config.cache.statisticsTTL),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;

      const statistics = await rankingManager.getLeaderboardStatistics();

      res.json({
        success: true,
        data: statistics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/top/:metric
 * Get top performers by metric
 */
router.get(
  '/top/:metric',
  validate(schemas.metric),
  cacheMiddleware(
    req => `top:${req.validated.metric}:${req.validated.limit}`,
    config.cache.statisticsTTL
  ),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const { metric, limit } = req.validated;

      const topPerformers = await rankingManager.getTopPerformers(metric, limit);

      res.json({
        success: true,
        data: {
          metric,
          limit,
          players: topPerformers
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/search
 * Search players by username
 */
router.get(
  '/search',
  validate(schemas.search),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const { q } = req.validated;

      const players = await rankingManager.searchPlayers(q);

      res.json({
        success: true,
        data: {
          query: q,
          results: players,
          count: players.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/history/:userId
 * Get user's rank history
 */
router.get(
  '/history/:userId',
  validate(schemas.history),
  cacheMiddleware(
    req => `history:${req.validated.userId}:${req.validated.days}`,
    config.cache.userPositionTTL
  ),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const { userId, days } = req.validated;

      const history = await rankingManager.getUserRankHistory(userId, days);

      if (history.length === 0) {
        throw new NotFoundError('No history found for user');
      }

      res.json({
        success: true,
        data: {
          userId,
          days,
          history
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/changes/:userId
 * Get user's rank changes
 */
router.get(
  '/changes/:userId',
  validate(schemas.userId),
  cacheMiddleware(
    req => `changes:${req.validated.userId}`,
    config.cache.userPositionTTL
  ),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const { userId } = req.validated;

      const changes = await rankingManager.getUserRankChanges(userId);

      res.json({
        success: true,
        data: {
          userId,
          changes
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/climbers
 * Get top climbers (biggest rank improvements)
 */
router.get(
  '/climbers',
  cacheMiddleware('climbers', config.cache.statisticsTTL),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const days = parseInt(req.query.days) || 7;
      const limit = parseInt(req.query.limit) || 10;

      const climbers = await rankingManager.getTopClimbers(days, limit);

      res.json({
        success: true,
        data: {
          days,
          limit,
          climbers
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/leaderboard/compare
 * Compare two players
 */
router.get(
  '/compare',
  validate(schemas.comparison),
  async (req, res, next) => {
    try {
      const { rankingManager } = req.app.locals;
      const { userId1, userId2 } = req.validated;

      const comparison = await rankingManager.comparePlayers(userId1, userId2);

      if (comparison.length < 2) {
        throw new NotFoundError('One or both users not found in leaderboard');
      }

      res.json({
        success: true,
        data: {
          players: comparison
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/leaderboard/refresh
 * Manually trigger leaderboard refresh (admin only)
 */
router.post(
  '/refresh',
  async (req, res, next) => {
    try {
      const { rankingManager, cache } = req.app.locals;

      await rankingManager.refreshLeaderboards();
      await cache.invalidateAll();

      res.json({
        success: true,
        message: 'Leaderboards refreshed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
