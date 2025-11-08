// JWT Service
// Handles JWT token validation, verification, and management

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const logger = require('../utils/logger');
const config = require('../config');
const { ValidationError, UnauthorizedError } = require('../utils/errors');

class JWTService {
  constructor() {
    this.jwksClient = jwksClient({
      jwksUri: config.cognito.jwksUri,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10
    });
  }

  // Verify JWT token from Cognito
  async verifyToken(token) {
    try {
      // Decode token header to get key ID
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new ValidationError('Invalid token format');
      }

      // Get signing key from JWKS
      const key = await this.getSigningKey(decoded.header.kid);
      
      // Verify token
      const payload = jwt.verify(token, key, {
        algorithms: ['RS256'],
        audience: config.cognito.clientId,
        issuer: config.cognito.issuer
      });

      // Additional validation
      this.validateTokenPayload(payload);
      
      return payload;
      
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new UnauthorizedError('Token not active yet');
      }
      
      logger.error('JWT verification error:', error);
      throw new UnauthorizedError('Token verification failed');
    }
  }

  // Get signing key from JWKS
  async getSigningKey(kid) {
    try {
      const key = await this.jwksClient.getSigningKey(kid);
      return key.getPublicKey();
    } catch (error) {
      logger.error('Error getting signing key:', error);
      throw new UnauthorizedError('Unable to verify token signature');
    }
  }

  // Validate token payload structure and claims
  validateTokenPayload(payload) {
    // Check required claims
    const requiredClaims = ['sub', 'email', 'iat', 'exp'];
    
    for (const claim of requiredClaims) {
      if (!payload[claim]) {
        throw new ValidationError(`Missing required claim: ${claim}`);
      }
    }

    // Validate token use
    if (payload.token_use && payload.token_use !== 'access' && payload.token_use !== 'id') {
      throw new ValidationError('Invalid token use');
    }

    // Validate email format
    if (payload.email && !this.isValidEmail(payload.email)) {
      throw new ValidationError('Invalid email format in token');
    }

    // Check if token is not expired (additional check)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      throw new UnauthorizedError('Token has expired');
    }

    // Check if token is active
    if (payload.nbf && payload.nbf > now) {
      throw new UnauthorizedError('Token not active yet');
    }
  }

  // Extract user information from token
  extractUserInfo(payload) {
    return {
      userId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
      givenName: payload.given_name || '',
      familyName: payload.family_name || '',
      displayName: this.getDisplayName(payload),
      picture: payload.picture || '',
      playerId: payload.player_id || payload['custom:player_id'] || '',
      gamesPlayed: parseInt(payload.games_played || payload['custom:games_played'] || '0'),
      gamesWon: parseInt(payload.games_won || payload['custom:games_won'] || '0'),
      winRate: payload.win_rate || 0,
      role: payload.role || 'player',
      permissions: payload.permissions || ['play_game', 'view_leaderboard', 'manage_profile'],
      authProvider: payload.auth_provider || 'Cognito',
      accountStatus: payload.account_status || 'active',
      tokenVersion: payload.token_version || '1.0',
      issuedAt: payload.iat,
      expiresAt: payload.exp
    };
  }

  // Generate display name from token claims
  getDisplayName(payload) {
    const givenName = payload.given_name || '';
    const familyName = payload.family_name || '';
    const fullName = `${givenName} ${familyName}`.trim();
    
    return fullName || payload.username || payload.email?.split('@')[0] || 'User';
  }

  // Create internal JWT token (for service-to-service communication)
  createInternalToken(payload, options = {}) {
    const {
      expiresIn = '1h',
      audience = 'internal',
      issuer = 'auth-service'
    } = options;

    const tokenPayload = {
      ...payload,
      aud: audience,
      iss: issuer,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn,
      algorithm: 'HS256'
    });
  }

  // Verify internal JWT token
  verifyInternalToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret, {
        algorithms: ['HS256']
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Internal token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid internal token');
      }
      
      throw new UnauthorizedError('Internal token verification failed');
    }
  }

  // Decode token without verification (for debugging)
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new ValidationError('Unable to decode token');
    }
  }

  // Check if token is expired
  isTokenExpired(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return true;
      }
      
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp <= now;
    } catch (error) {
      return true;
    }
  }

  // Get token expiration time
  getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      return decoded?.exp ? new Date(decoded.exp * 1000) : null;
    } catch (error) {
      return null;
    }
  }

  // Validate API key (for service-to-service authentication)
  validateApiKey(apiKey) {
    if (!apiKey) {
      throw new UnauthorizedError('API key is required');
    }

    // In production, this should check against a secure store
    const validApiKeys = config.auth.validApiKeys || [];
    
    if (!validApiKeys.includes(apiKey)) {
      throw new UnauthorizedError('Invalid API key');
    }

    return true;
  }

  // Create refresh token
  createRefreshToken(userId) {
    const payload = {
      sub: userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: '30d',
      algorithm: 'HS256'
    });
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      const payload = jwt.verify(token, config.jwt.refreshSecret, {
        algorithms: ['HS256']
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('Invalid token type');
      }

      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Refresh token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid refresh token');
      }
      
      throw new UnauthorizedError('Refresh token verification failed');
    }
  }

  // Extract bearer token from authorization header
  extractBearerToken(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  // Validate permissions
  hasPermission(userPermissions, requiredPermission) {
    if (!Array.isArray(userPermissions)) {
      return false;
    }

    return userPermissions.includes(requiredPermission) || 
           userPermissions.includes('admin') ||
           userPermissions.includes('*');
  }

  // Check if user has any of the required roles
  hasRole(userRole, requiredRoles) {
    if (!Array.isArray(requiredRoles)) {
      requiredRoles = [requiredRoles];
    }

    return requiredRoles.includes(userRole) || 
           userRole === 'admin' ||
           userRole === 'superuser';
  }

  // Private helper methods
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = JWTService;