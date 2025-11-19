// Error handling middleware
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: 'Not found',
      status: 404,
      path: req.path
    }
  });
}

module.exports = { errorHandler, notFoundHandler };
