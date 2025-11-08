// Authentication Middleware
// JWT token validation and user authentication

const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

// Main authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const jwtService = req.app.locals.services.jwt;
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = jwtService.extractBearerToken(authHeader);
    
    if (!token) {
      throw new UnauthorizedError('Access token is required');
    }

    // Verify token
    const payload = await jwtService.verifyToken(token);
    
    // Extract user information
    const userInfo = jwtService.extractUserInfo(payload);
    
    // Attach user info to request
    req.user = userInfo;
    req.token = token;
    
    // Log authentication
    logger.debug(`User authenticated: ${userInfo.userId} (${userInfo.email})`);
    
    next();
    
  } catch (error) {
    logger.warn('Authentication failed:', error.message);
    
    if (error instanceof UnauthorizedError) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: error.message
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
};

// Optional authentication middleware (allows both authenticated and unauthenticated requests)
const optionalAuth = async (req, res, next) => {
  try {
    const jwtService = req.app.locals.services.jwt;
    
    const authHeader = req.headers.authorization;
    const token = jwtService.extractBearerToken(authHeader);
    
    if (token) {
      try {
        const payload = await jwtService.verifyToken(token);
        const userInfo = jwtService.extractUserInfo(payload);
        
        req.user = userInfo;
        req.token = token;
        req.authenticated = true;
      } catch (error) {
        // Token is invalid, but we allow the request to continue
        req.authenticated = false;
        logger.debug('Optional auth failed, continuing as unauthenticated:', error.message);
      }
    } else {
      req.authenticated = false;
    }
    
    next();
    
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    req.authenticated = false;
    next();
  }
};

// Permission-based authorization middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const jwtService = req.app.locals.services.jwt;
      
      if (!jwtService.hasPermission(req.user.permissions, permission)) {
        throw new ForbiddenError(`Permission '${permission}' is required`);
      }
      
      next();
      
    } catch (error) {
      logger.warn(`Permission check failed for ${permission}:`, error.message);
      
      if (error instanceof ForbiddenError) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: error.message
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
  };
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const jwtService = req.app.locals.services.jwt;
      
      if (!jwtService.hasRole(req.user.role, roles)) {
        const roleList = Array.isArray(roles) ? roles.join(', ') : roles;
        throw new ForbiddenError(`Role '${roleList}' is required`);
      }
      
      next();
      
    } catch (error) {
      logger.warn(`Role check failed for ${roles}:`, error.message);
      
      if (error instanceof ForbiddenError) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: error.message
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
  };
};

// API key authentication middleware (for service-to-service communication)
const authenticateApiKey = (req, res, next) => {
  try {
    const jwtService = req.app.locals.services.jwt;
    
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      throw new UnauthorizedError('API key is required');
    }

    jwtService.validateApiKey(apiKey);
    
    // Mark request as service-to-service
    req.serviceAuth = true;
    req.apiKey = apiKey;
    
    logger.debug('Service authenticated with API key');
    
    next();
    
  } catch (error) {
    logger.warn('API key authentication failed:', error.message);
    
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }
};

// Internal token authentication (for service-to-service JWT)
const authenticateInternalToken = (req, res, next) => {
  try {
    const jwtService = req.app.locals.services.jwt;
    
    const authHeader = req.headers.authorization;
    const token = jwtService.extractBearerToken(authHeader);
    
    if (!token) {
      throw new UnauthorizedError('Internal token is required');
    }

    const payload = jwtService.verifyInternalToken(token);
    
    req.serviceAuth = true;
    req.internalToken = payload;
    
    logger.debug('Service authenticated with internal token');
    
    next();
    
  } catch (error) {
    logger.warn('Internal token authentication failed:', error.message);
    
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid internal token'
    });
  }
};

// Account status validation middleware
const requireActiveAccount = (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (req.user.accountStatus !== 'active') {
      throw new ForbiddenError('Account is not active');
    }
    
    next();
    
  } catch (error) {
    logger.warn('Account status check failed:', error.message);
    
    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
};

// Email verification requirement middleware
const requireVerifiedEmail = (req, res, next) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!req.user.emailVerified) {
      throw new ForbiddenError('Email verification is required');
    }
    
    next();
    
  } catch (error) {
    logger.warn('Email verification check failed:', error.message);
    
    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message,
        code: 'EMAIL_NOT_VERIFIED'
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
};

// Rate limiting by user ID
const rateLimitByUser = (maxRequests = 100, windowMs = 60000) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    const userId = req.user?.userId || req.ip;
    const now = Date.now();
    
    // Clean up old entries
    for (const [key, data] of userRequests.entries()) {
      if (now - data.resetTime > windowMs) {
        userRequests.delete(key);
      }
    }
    
    // Check current user's requests
    const userRequestData = userRequests.get(userId) || {
      count: 0,
      resetTime: now + windowMs
    };
    
    if (userRequestData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((userRequestData.resetTime - now) / 1000)
      });
    }
    
    userRequestData.count++;
    userRequests.set(userId, userRequestData);
    
    next();
  };
};

// Combine multiple auth methods (OR logic)
const authenticateAny = (...authMethods) => {
  return async (req, res, next) => {
    let lastError = null;
    
    for (const authMethod of authMethods) {
      try {
        // Create a mock response to capture auth method results
        const mockRes = {
          status: () => mockRes,
          json: () => mockRes
        };
        
        let authPassed = false;
        const mockNext = () => { authPassed = true; };
        
        await authMethod(req, mockRes, mockNext);
        
        if (authPassed) {
          return next();
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    
    // If we get here, all auth methods failed
    logger.warn('All authentication methods failed:', lastError?.message);
    
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requirePermission,
  requireRole,
  authenticateApiKey,
  authenticateInternalToken,
  requireActiveAccount,
  requireVerifiedEmail,
  rateLimitByUser,
  authenticateAny
};