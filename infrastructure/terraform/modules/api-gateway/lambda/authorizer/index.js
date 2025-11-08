// API Gateway Lambda Authorizer
// Validates API keys and JWT tokens for service authentication

const jwt = require('jsonwebtoken');

// Environment variables
const VALID_API_KEYS = JSON.parse(process.env.VALID_API_KEYS || '[]');
const JWT_SECRET = process.env.JWT_SECRET;
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

// Logging utility
function log(level, message, data = {}) {
  if (shouldLog(level)) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data
    }));
  }
}

function shouldLog(level) {
  const levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  return levels[level] <= levels[LOG_LEVEL];
}

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(principalId, effect, resource, context = {}) {
  const policy = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context
  };

  log('DEBUG', 'Generated policy', { policy });
  return policy;
}

/**
 * Validate API key
 */
function validateApiKey(apiKey) {
  if (!apiKey) {
    log('WARN', 'No API key provided');
    return false;
  }

  const isValid = VALID_API_KEYS.includes(apiKey);
  log('DEBUG', 'API key validation', { valid: isValid });
  return isValid;
}

/**
 * Validate JWT token
 */
function validateJwtToken(token) {
  try {
    if (!token || !JWT_SECRET) {
      log('WARN', 'No token or JWT secret provided');
      return null;
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    log('DEBUG', 'JWT token validated', { userId: decoded.sub || decoded.userId });
    
    return decoded;
  } catch (error) {
    log('WARN', 'JWT validation failed', { error: error.message });
    return null;
  }
}

/**
 * Extract authentication information from event
 */
function extractAuthInfo(event) {
  const headers = event.headers || {};
  const queryParams = event.queryStringParameters || {};
  
  // Extract API key from header or query parameter
  const apiKey = headers['x-api-key'] || 
                 headers['X-Api-Key'] || 
                 queryParams.api_key;
  
  // Extract JWT token from Authorization header
  const authHeader = headers.Authorization || headers.authorization;
  const jwtToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader : null;
  
  return { apiKey, jwtToken };
}

/**
 * Determine authentication method and validate
 */
function authenticate(event) {
  const { apiKey, jwtToken } = extractAuthInfo(event);
  
  log('DEBUG', 'Authentication attempt', {
    hasApiKey: !!apiKey,
    hasJwtToken: !!jwtToken,
    path: event.path,
    method: event.httpMethod
  });
  
  // Check for API key authentication (service-to-service)
  if (apiKey) {
    if (validateApiKey(apiKey)) {
      return {
        success: true,
        principalId: `api-key:${apiKey.substring(0, 8)}...`,
        context: {
          authType: 'api-key',
          service: 'internal'
        }
      };
    }
  }
  
  // Check for JWT token authentication (user)
  if (jwtToken) {
    const decoded = validateJwtToken(jwtToken);
    if (decoded) {
      return {
        success: true,
        principalId: decoded.sub || decoded.userId || 'user',
        context: {
          authType: 'jwt',
          userId: decoded.sub || decoded.userId,
          email: decoded.email,
          role: decoded.role || 'user',
          permissions: JSON.stringify(decoded.permissions || []),
          tokenExp: decoded.exp
        }
      };
    }
  }
  
  // No valid authentication found
  log('WARN', 'Authentication failed', {
    path: event.path,
    method: event.httpMethod,
    sourceIp: event.requestContext?.identity?.sourceIp
  });
  
  return {
    success: false,
    error: 'Unauthorized'
  };
}

/**
 * Check if path requires authentication
 */
function requiresAuth(path, method) {
  // Public endpoints that don't require authentication
  const publicPaths = [
    '/health',
    '/auth/oauth/url',
    '/auth/config',
    '/faq/search',
    '/faq',
    '/leaderboard/global',
    '/leaderboard/regional'
  ];
  
  // OPTIONS requests for CORS
  if (method === 'OPTIONS') {
    return false;
  }
  
  // Check if path is public
  for (const publicPath of publicPaths) {
    if (path.startsWith(publicPath)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  try {
    log('INFO', 'Authorization request', {
      path: event.path,
      method: event.httpMethod,
      sourceIp: event.requestContext?.identity?.sourceIp,
      userAgent: event.requestContext?.identity?.userAgent
    });
    
    const { path, httpMethod } = event;
    
    // Check if authentication is required for this path
    if (!requiresAuth(path, httpMethod)) {
      log('DEBUG', 'Public endpoint, allowing access', { path, method: httpMethod });
      return generatePolicy('public', 'Allow', event.methodArn, {
        authType: 'public'
      });
    }
    
    // Perform authentication
    const authResult = authenticate(event);
    
    if (authResult.success) {
      log('INFO', 'Authentication successful', {
        principalId: authResult.principalId,
        authType: authResult.context.authType
      });
      
      return generatePolicy(
        authResult.principalId,
        'Allow',
        event.methodArn,
        authResult.context
      );
    } else {
      log('WARN', 'Authentication failed', {
        error: authResult.error,
        path,
        method: httpMethod
      });
      
      // Return Deny policy
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }
    
  } catch (error) {
    log('ERROR', 'Authorizer error', {
      error: error.message,
      stack: error.stack,
      event: JSON.stringify(event)
    });
    
    // In case of error, deny access
    return generatePolicy('error', 'Deny', event.methodArn);
  }
};

// Export for testing
module.exports = {
  handler: exports.handler,
  validateApiKey,
  validateJwtToken,
  generatePolicy,
  requiresAuth,
  authenticate
};
