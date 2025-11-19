// Request Validation Middleware
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware to validate request body against a Joi schema
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      logger.warn('Request validation failed:', {
        path: req.path,
        method: req.method,
        errors: error.details
      });
      
      return next(new ValidationError(errorMessage));
    }

    // Replace request body with validated and sanitized value
    req.body = value;
    next();
  };
};

/**
 * Middleware to validate query parameters against a Joi schema
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      logger.warn('Query validation failed:', {
        path: req.path,
        method: req.method,
        errors: error.details
      });
      
      return next(new ValidationError(errorMessage));
    }

    req.query = value;
    next();
  };
};

/**
 * Middleware to validate route parameters against a Joi schema
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      logger.warn('Params validation failed:', {
        path: req.path,
        method: req.method,
        errors: error.details
      });
      
      return next(new ValidationError(errorMessage));
    }

    req.params = value;
    next();
  };
};

module.exports = {
  validateRequest,
  validateQuery,
  validateParams
};
