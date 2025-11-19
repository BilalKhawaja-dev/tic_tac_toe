// Health Check Routes
const express = require('express');
const router = express.Router();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /health/ready
 * Readiness check - indicates if service is ready to accept traffic
 */
router.get('/ready', (req, res) => {
  // Check if all required services are initialized
  const services = req.app.locals.services || {};
  
  const isReady = !!(services.cognito && services.jwt && services.user);
  
  if (isReady) {
    res.json({
      status: 'ready',
      service: 'auth-service',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      service: 'auth-service',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/live
 * Liveness check - indicates if service is alive
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
