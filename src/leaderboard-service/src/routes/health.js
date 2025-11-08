// Health Check Routes
// Provides health and readiness endpoints for monitoring

const express = require('express');
const router = express.Router();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    const { rankingManager, cache } = req.app.locals;

    // Check database health
    const dbHealth = await rankingManager.healthCheck();

    // Check cache health
    const cacheHealth = await cache.healthCheck();

    const isHealthy = dbHealth.healthy && cacheHealth;

    res.status(isHealthy ? 200 : 503).json({
      success: true,
      service: 'Leaderboard Service',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          healthy: dbHealth.healthy,
          timestamp: dbHealth.timestamp
        },
        cache: {
          healthy: cacheHealth
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'Leaderboard Service',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/ready
 * Readiness check for Kubernetes/ECS
 */
router.get('/ready', async (req, res) => {
  try {
    const { rankingManager, cache } = req.app.locals;

    const dbHealth = await rankingManager.healthCheck();
    const cacheHealth = await cache.healthCheck();

    const isReady = dbHealth.healthy && cacheHealth;

    if (isReady) {
      res.status(200).json({
        success: true,
        ready: true,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        ready: false,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/live
 * Liveness check for Kubernetes/ECS
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    success: true,
    alive: true,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health/stats
 * Service statistics and metrics
 */
router.get('/stats', async (req, res) => {
  try {
    const { rankingManager, cache } = req.app.locals;

    const [dbStats, cacheStats] = await Promise.all([
      rankingManager.getDatabaseStats(),
      cache.getCacheStats()
    ]);

    res.json({
      success: true,
      data: {
        database: dbStats,
        cache: cacheStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
