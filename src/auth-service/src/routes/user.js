// User Profile Routes
// Protected routes for user profile management

const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  givenName: Joi.string().max(50).optional(),
  familyName: Joi.string().max(50).optional(),
  pictureUrl: Joi.string().uri().max(2048).optional()
});

const updatePreferencesSchema = Joi.object({
  theme: Joi.string().valid('light', 'dark').optional(),
  language: Joi.string().length(2).optional(),
  notifications: Joi.object({
    email: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
    gameInvites: Joi.boolean().optional(),
    achievements: Joi.boolean().optional()
  }).optional(),
  privacy: Joi.object({
    showOnlineStatus: Joi.boolean().optional(),
    showGameHistory: Joi.boolean().optional(),
    allowFriendRequests: Joi.boolean().optional()
  }).optional(),
  gameplay: Joi.object({
    autoAcceptRematches: Joi.boolean().optional(),
    showMoveHints: Joi.boolean().optional(),
    soundEffects: Joi.boolean().optional()
  }).optional()
});

const searchUsersSchema = Joi.object({
  q: Joi.string().min(2).max(50).required(),
  limit: Joi.number().integer().min(1).max(50).default(10),
  offset: Joi.number().integer().min(0).default(0)
});

// Get current user profile
router.get('/profile', async (req, res, next) => {
  try {
    const userId = req.user.sub; // From JWT token
    const userService = req.app.locals.services.user;
    
    const profile = await userService.getUserProfile(userId);
    
    res.json({
      success: true,
      data: profile
    });
    
  } catch (error) {
    next(error);
  }
});

// Update current user profile
router.put('/profile', validateRequest(updateProfileSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userService = req.app.locals.services.user;
    const cognitoService = req.app.locals.services.cognito;
    
    const updates = {};
    
    if (req.body.givenName !== undefined) {
      updates.given_name = req.body.givenName;
    }
    
    if (req.body.familyName !== undefined) {
      updates.family_name = req.body.familyName;
    }
    
    if (req.body.pictureUrl !== undefined) {
      updates.picture_url = req.body.pictureUrl;
    }
    
    // Update in database
    const updatedProfile = await userService.updateUserProfile(userId, updates);
    
    // Update in Cognito
    const cognitoUpdates = {};
    if (updates.given_name !== undefined) {
      cognitoUpdates.given_name = updates.given_name;
    }
    if (updates.family_name !== undefined) {
      cognitoUpdates.family_name = updates.family_name;
    }
    if (updates.picture_url !== undefined) {
      cognitoUpdates.picture = updates.picture_url;
    }
    
    if (Object.keys(cognitoUpdates).length > 0) {
      await cognitoService.updateCognitoUserAttributes(userId, cognitoUpdates);
    }
    
    res.json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

// Get user preferences
router.get('/preferences', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userService = req.app.locals.services.user;
    
    const preferences = await userService.getUserPreferences(userId);
    
    res.json({
      success: true,
      data: preferences
    });
    
  } catch (error) {
    next(error);
  }
});

// Update user preferences
router.put('/preferences', validateRequest(updatePreferencesSchema), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userService = req.app.locals.services.user;
    
    const preferences = await userService.updateUserPreferences(userId, req.body);
    
    res.json({
      success: true,
      data: preferences,
      message: 'Preferences updated successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

// Get user game history
router.get('/games', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userService = req.app.locals.services.user;
    
    const options = {
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
      status: req.query.status || null,
      opponent: req.query.opponent || null
    };
    
    const gameHistory = await userService.getUserGameHistory(userId, options);
    
    res.json({
      success: true,
      data: gameHistory,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        hasMore: gameHistory.length === options.limit
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Get user leaderboard position
router.get('/leaderboard-position', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userService = req.app.locals.services.user;
    
    const position = await userService.getUserLeaderboardPosition(userId);
    
    res.json({
      success: true,
      data: position
    });
    
  } catch (error) {
    next(error);
  }
});

// Search users
router.get('/search', validateRequest(searchUsersSchema, 'query'), async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userService = req.app.locals.services.user;
    
    const options = {
      limit: req.query.limit,
      offset: req.query.offset,
      excludeUserId: userId
    };
    
    const users = await userService.searchUsers(req.query.q, options);
    
    res.json({
      success: true,
      data: users,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        hasMore: users.length === options.limit
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Get user profile by player ID (public endpoint)
router.get('/profile/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const userService = req.app.locals.services.user;
    
    const profile = await userService.getUserProfileByPlayerId(playerId);
    
    // Return only public information
    const publicProfile = {
      playerId: profile.playerId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      stats: {
        gamesPlayed: profile.stats.gamesPlayed,
        gamesWon: profile.stats.gamesWon,
        winRate: profile.stats.winRate,
        rankPoints: profile.stats.rankPoints,
        rankTier: profile.stats.rankTier,
        currentStreak: profile.stats.currentStreak,
        bestStreak: profile.stats.bestStreak
      },
      createdAt: profile.createdAt
    };
    
    res.json({
      success: true,
      data: publicProfile
    });
    
  } catch (error) {
    next(error);
  }
});

// Update user statistics (internal endpoint - called by game service)
router.post('/stats', async (req, res, next) => {
  try {
    // This endpoint should be protected by API key or internal service authentication
    // For now, we'll use the JWT token but in production this should be service-to-service
    
    const userId = req.user.sub;
    const userService = req.app.locals.services.user;
    const cognitoService = req.app.locals.services.cognito;
    
    const statsUpdate = {
      gamesPlayed: req.body.gamesPlayed || 0,
      gamesWon: req.body.gamesWon || 0,
      gamesLost: req.body.gamesLost || 0,
      gamesDrawn: req.body.gamesDrawn || 0,
      scoreChange: req.body.scoreChange || 0,
      streakChange: req.body.streakChange || 0
    };
    
    const updatedStats = await userService.updateUserStats(userId, statsUpdate);
    
    // Sync to Cognito for JWT token claims
    await cognitoService.syncUserStatsToCognito(userId, updatedStats);
    
    res.json({
      success: true,
      data: updatedStats,
      message: 'Statistics updated successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

// Delete user account
router.delete('/account', async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userService = req.app.locals.services.user;
    const cognitoService = req.app.locals.services.cognito;
    
    // Soft delete in database (set is_active = false)
    await userService.updateUserProfile(userId, { is_active: false });
    
    // Disable in Cognito
    await cognitoService.disableCognitoUser(userId);
    
    logger.info(`User account deleted: ${userId}`);
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;