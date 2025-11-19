// Health check routes
const express = require('express');
const router = express.Router();

// Main health check endpoint - mounted at /health so this becomes /health
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'game-engine',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness check - becomes /health/ready
router.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    service: 'game-engine',
    timestamp: new Date().toISOString()
  });
});

// Liveness check - becomes /health/live
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    service: 'game-engine',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
