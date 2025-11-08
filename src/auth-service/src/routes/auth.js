// Authentication Routes
// Public routes for authentication and token management

const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');
const { ValidationError, UnauthorizedError } = require('../utils/errors');
const { validateRequest } = require('../middleware/validation');
const { optionalAuth, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const validateTokenSchema = Joi.object({
  token: Joi.string().required()
});

// OAuth authorization URL generation
router.get('/oauth/url/:provider', (req, res, next) => {
  try {
    const { provider } = req.params;
    const { state, redirect_uri } = req.query;
    
    const cognitoService = req.app.locals.services.cognito;
    
    // Validate provider
    const validProviders = ['google', 'facebook', 'amazon', 'cognito'];
    if (!validProviders.includes(provider.toLowerCase())) {
      throw new ValidationError('Invalid OAuth provider');
    }
    
    // Generate OAuth URL
    const authUrl = cognitoService.generateOAuthUrl(
      provider.toLowerCase() === 'cognito' ? null : provider,
      state
    );
    
    res.json({
      success: true,
      data: {
        authUrl,
        provider,
        state
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// OAuth logout URL generation
router.get('/oauth/logout', optionalAuth, (req, res, next) => {
  try {
    const { redirect_uri } = req.query;
    const cognitoService = req.app.locals.services.cognito;
    
    const logoutUrl = cognitoService.generateLogoutUrl(redirect_uri);
    
    res.json({
      success: true,
      data: {
        logoutUrl
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Token validation endpoint
router.post('/validate', validateRequest(validateTokenSchema), async (req, res, next) => {
  try {
    const { token } = req.body;
    const jwtService = req.app.locals.services.jwt;
    
    // Verify token
    const payload = await jwtService.verifyToken(token);
    const userInfo = jwtService.extractUserInfo(payload);
    
    // Check if token is expired
    const isExpired = jwtService.isTokenExpired(token);
    const expiresAt = jwtService.getTokenExpiration(token);
    
    res.json({
      success: true,
      data: {
        valid: !isExpired,
        expired: isExpired,
        expiresAt,
        user: {
          userId: userInfo.userId,
          email: userInfo.email,
          displayName: userInfo.displayName,
          playerId: userInfo.playerId,
          role: userInfo.role,
          permissions: userInfo.permissions,
          accountStatus: userInfo.accountStatus
        }
      }
    });
    
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return res.json({
        success: true,
        data: {
          valid: false,
          expired: true,
          error: error.message
        }
      });
    }
    
    next(error);
  }
});

// Token refresh endpoint
router.post('/refresh', validateRequest(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const jwtService = req.app.locals.services.jwt;
    const cognitoService = req.app.locals.services.cognito;
    
    // Verify refresh token
    const refreshPayload = jwtService.verifyRefreshToken(refreshToken);
    
    // Get fresh user data from Cognito
    const cognitoUser = await cognitoService.getCognitoUser(refreshPayload.sub);
    
    // Generate new tokens (this would typically involve calling Cognito's refresh endpoint)
    // For now, we'll return the refresh token flow structure
    
    res.json({
      success: true,
      data: {
        message: 'Token refresh initiated',
        userId: refreshPayload.sub,
        // In production, this would return new access and ID tokens from Cognito
        refreshRequired: true
      }
    });
    
  } catch (error) {
    logger.warn('Token refresh failed:', error.message);
    
    if (error instanceof UnauthorizedError) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: error.message
      });
    }
    
    next(error);
  }
});

// Get current user info from token
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.user.userId,
      email: req.user.email,
      emailVerified: req.user.emailVerified,
      displayName: req.user.displayName,
      givenName: req.user.givenName,
      familyName: req.user.familyName,
      picture: req.user.picture,
      playerId: req.user.playerId,
      gamesPlayed: req.user.gamesPlayed,
      gamesWon: req.user.gamesWon,
      winRate: req.user.winRate,
      role: req.user.role,
      permissions: req.user.permissions,
      authProvider: req.user.authProvider,
      accountStatus: req.user.accountStatus,
      tokenVersion: req.user.tokenVersion,
      issuedAt: new Date(req.user.issuedAt * 1000),
      expiresAt: new Date(req.user.expiresAt * 1000)
    }
  });
});

// Token introspection (detailed token info)
router.get('/introspect', authenticateToken, (req, res) => {
  const jwtService = req.app.locals.services.jwt;
  const decodedToken = jwtService.decodeToken(req.token);
  
  res.json({
    success: true,
    data: {
      header: decodedToken.header,
      payload: decodedToken.payload,
      user: req.user,
      tokenInfo: {
        algorithm: decodedToken.header.alg,
        keyId: decodedToken.header.kid,
        tokenType: decodedToken.payload.token_use,
        audience: decodedToken.payload.aud,
        issuer: decodedToken.payload.iss,
        issuedAt: new Date(decodedToken.payload.iat * 1000),
        expiresAt: new Date(decodedToken.payload.exp * 1000),
        notBefore: decodedToken.payload.nbf ? new Date(decodedToken.payload.nbf * 1000) : null
      }
    }
  });
});

// Create internal service token
router.post('/internal/token', authenticateToken, (req, res, next) => {
  try {
    // Only allow admin users to create internal tokens
    if (req.user.role !== 'admin' && req.user.role !== 'service') {
      throw new UnauthorizedError('Insufficient privileges to create internal tokens');
    }
    
    const jwtService = req.app.locals.services.jwt;
    
    const payload = {
      sub: req.user.userId,
      service: req.body.service || 'unknown',
      permissions: req.body.permissions || ['read'],
      createdBy: req.user.userId
    };
    
    const options = {
      expiresIn: req.body.expiresIn || '1h',
      audience: req.body.audience || 'internal'
    };
    
    const internalToken = jwtService.createInternalToken(payload, options);
    
    res.json({
      success: true,
      data: {
        token: internalToken,
        expiresIn: options.expiresIn,
        audience: options.audience
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Health check for auth service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Authentication Service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    }
  });
});

// Get authentication configuration (public endpoint)
router.get('/config', (req, res) => {
  const config = req.app.locals.config || {};
  
  res.json({
    success: true,
    data: {
      providers: {
        cognito: true,
        google: config.cognito?.enableGoogle || false,
        facebook: config.cognito?.enableFacebook || false,
        amazon: config.cognito?.enableAmazon || false
      },
      features: {
        emailVerification: true,
        passwordReset: true,
        mfa: false, // Can be enabled later
        socialLogin: true
      },
      tokenInfo: {
        accessTokenValidity: '1 hour',
        refreshTokenValidity: '30 days',
        algorithm: 'RS256'
      }
    }
  });
});

// Logout endpoint (invalidate token on client side)
router.post('/logout', optionalAuth, (req, res) => {
  // In a stateless JWT system, logout is primarily handled client-side
  // However, we can log the logout event and potentially blacklist tokens
  
  if (req.user) {
    logger.info(`User logged out: ${req.user.userId} (${req.user.email})`);
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully',
    data: {
      loggedOut: true,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;