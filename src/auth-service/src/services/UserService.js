// User Profile Service
// Manages user profiles, statistics, and preferences

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

class UserService {
  constructor(dbManager, cacheManager) {
    this.db = dbManager;
    this.cache = cacheManager;
    this.cachePrefix = 'user:';
    this.cacheTTL = 3600; // 1 hour
  }

  // Get user profile by ID
  async getUserProfile(userId) {
    try {
      // Try cache first
      const cacheKey = `${this.cachePrefix}profile:${userId}`;
      const cachedProfile = await this.cache.get(cacheKey);
      
      if (cachedProfile) {
        return JSON.parse(cachedProfile);
      }

      // Query database
      const query = `
        SELECT 
          u.user_id,
          u.player_id,
          u.email,
          u.given_name,
          u.family_name,
          u.picture_url,
          u.auth_provider,
          u.is_active,
          u.email_verified,
          u.created_at,
          u.updated_at,
          u.last_login_at,
          u.login_count,
          us.games_played,
          us.games_won,
          us.games_lost,
          us.games_drawn,
          us.total_score,
          us.rank_points,
          us.rank_tier,
          us.current_streak,
          us.best_streak,
          us.updated_at as stats_updated_at
        FROM users u
        LEFT JOIN user_stats us ON u.user_id = us.user_id
        WHERE u.user_id = $1 AND u.is_active = true
      `;

      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const profile = this.formatUserProfile(result.rows[0]);
      
      // Cache the result
      await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(profile));
      
      return profile;
      
    } catch (error) {
      logger.error('Error getting user profile:', error);
      throw error;
    }
  }

  // Get user profile by player ID
  async getUserProfileByPlayerId(playerId) {
    try {
      const query = `
        SELECT user_id FROM users 
        WHERE player_id = $1 AND is_active = true
      `;

      const result = await this.db.query(query, [playerId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Player not found');
      }

      return await this.getUserProfile(result.rows[0].user_id);
      
    } catch (error) {
      logger.error('Error getting user profile by player ID:', error);
      throw error;
    }
  }

  // Update user profile
  async updateUserProfile(userId, updates) {
    try {
      this.validateProfileUpdates(updates);

      const allowedFields = [
        'given_name', 'family_name', 'picture_url'
      ];

      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      // Build dynamic update query
      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.includes(field) && value !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No valid fields to update');
      }

      // Add updated_at timestamp
      updateFields.push(`updated_at = $${paramIndex}`);
      values.push(new Date());
      paramIndex++;

      // Add user_id for WHERE clause
      values.push(userId);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE user_id = $${paramIndex} AND is_active = true
        RETURNING user_id, given_name, family_name, picture_url, updated_at
      `;

      const result = await this.db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      // Invalidate cache
      await this.invalidateUserCache(userId);
      
      logger.info(`User profile updated: ${userId}`);
      
      return result.rows[0];
      
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Update user statistics
  async updateUserStats(userId, statsUpdate) {
    try {
      this.validateStatsUpdate(statsUpdate);

      const {
        gamesPlayed = 0,
        gamesWon = 0,
        gamesLost = 0,
        gamesDrawn = 0,
        scoreChange = 0,
        streakChange = 0
      } = statsUpdate;

      const query = `
        UPDATE user_stats 
        SET 
          games_played = games_played + $1,
          games_won = games_won + $2,
          games_lost = games_lost + $3,
          games_drawn = games_drawn + $4,
          total_score = total_score + $5,
          current_streak = CASE 
            WHEN $6 > 0 THEN current_streak + $6
            WHEN $6 < 0 THEN 0
            ELSE current_streak
          END,
          best_streak = CASE 
            WHEN current_streak + $6 > best_streak THEN current_streak + $6
            ELSE best_streak
          END,
          rank_points = GREATEST(0, rank_points + $7),
          updated_at = $8
        WHERE user_id = $9
        RETURNING *
      `;

      const rankPointsChange = this.calculateRankPointsChange(statsUpdate);
      const now = new Date();

      const result = await this.db.query(query, [
        gamesPlayed,
        gamesWon,
        gamesLost,
        gamesDrawn,
        scoreChange,
        streakChange,
        rankPointsChange,
        now,
        userId
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError('User stats not found');
      }

      const updatedStats = result.rows[0];
      
      // Update rank tier based on new rank points
      await this.updateRankTier(userId, updatedStats.rank_points);
      
      // Invalidate cache
      await this.invalidateUserCache(userId);
      
      logger.info(`User stats updated: ${userId}`, statsUpdate);
      
      return updatedStats;
      
    } catch (error) {
      logger.error('Error updating user stats:', error);
      throw error;
    }
  }

  // Get user preferences
  async getUserPreferences(userId) {
    try {
      const cacheKey = `${this.cachePrefix}preferences:${userId}`;
      const cachedPrefs = await this.cache.get(cacheKey);
      
      if (cachedPrefs) {
        return JSON.parse(cachedPrefs);
      }

      const query = `
        SELECT preferences FROM user_preferences 
        WHERE user_id = $1
      `;

      const result = await this.db.query(query, [userId]);
      
      const preferences = result.rows.length > 0 
        ? result.rows[0].preferences 
        : this.getDefaultPreferences();
      
      // Cache the result
      await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(preferences));
      
      return preferences;
      
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      throw error;
    }
  }

  // Update user preferences
  async updateUserPreferences(userId, preferences) {
    try {
      this.validatePreferences(preferences);

      const query = `
        INSERT INTO user_preferences (user_id, preferences, created_at, updated_at)
        VALUES ($1, $2, $3, $3)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          preferences = $2,
          updated_at = $3
        RETURNING preferences
      `;

      const now = new Date();
      const result = await this.db.query(query, [userId, preferences, now]);
      
      // Invalidate cache
      const cacheKey = `${this.cachePrefix}preferences:${userId}`;
      await this.cache.del(cacheKey);
      
      logger.info(`User preferences updated: ${userId}`);
      
      return result.rows[0].preferences;
      
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  // Get user's game history
  async getUserGameHistory(userId, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        status = null,
        opponent = null
      } = options;

      let whereClause = 'WHERE (g.player1_id = $1 OR g.player2_id = $1)';
      const params = [userId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND g.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (opponent) {
        whereClause += ` AND (
          (g.player1_id = $1 AND g.player2_id = $${paramIndex}) OR
          (g.player2_id = $1 AND g.player1_id = $${paramIndex})
        )`;
        params.push(opponent);
        paramIndex++;
      }

      const query = `
        SELECT 
          g.game_id,
          g.status,
          g.winner_id,
          g.started_at,
          g.completed_at,
          g.game_data,
          u1.player_id as player1_player_id,
          u1.given_name as player1_name,
          u2.player_id as player2_player_id,
          u2.given_name as player2_name
        FROM games g
        LEFT JOIN users u1 ON g.player1_id = u1.user_id
        LEFT JOIN users u2 ON g.player2_id = u2.user_id
        ${whereClause}
        ORDER BY g.started_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await this.db.query(query, params);
      
      return result.rows.map(row => this.formatGameHistory(row, userId));
      
    } catch (error) {
      logger.error('Error getting user game history:', error);
      throw error;
    }
  }

  // Get leaderboard position for user
  async getUserLeaderboardPosition(userId) {
    try {
      const cacheKey = `${this.cachePrefix}leaderboard:${userId}`;
      const cachedPosition = await this.cache.get(cacheKey);
      
      if (cachedPosition) {
        return JSON.parse(cachedPosition);
      }

      const query = `
        WITH ranked_users AS (
          SELECT 
            user_id,
            rank_points,
            games_played,
            games_won,
            ROW_NUMBER() OVER (ORDER BY rank_points DESC, games_won DESC) as position
          FROM user_stats
          WHERE games_played > 0
        )
        SELECT 
          position,
          rank_points,
          games_played,
          games_won,
          (SELECT COUNT(*) FROM ranked_users) as total_players
        FROM ranked_users
        WHERE user_id = $1
      `;

      const result = await this.db.query(query, [userId]);
      
      const position = result.rows.length > 0 
        ? {
            position: parseInt(result.rows[0].position),
            rank_points: result.rows[0].rank_points,
            total_players: parseInt(result.rows[0].total_players),
            percentile: Math.round((1 - (result.rows[0].position / result.rows[0].total_players)) * 100)
          }
        : {
            position: null,
            rank_points: 1000,
            total_players: 0,
            percentile: 0
          };
      
      // Cache for 5 minutes
      await this.cache.setex(cacheKey, 300, JSON.stringify(position));
      
      return position;
      
    } catch (error) {
      logger.error('Error getting user leaderboard position:', error);
      throw error;
    }
  }

  // Search users by username or display name
  async searchUsers(query, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        excludeUserId = null
      } = options;

      let whereClause = `
        WHERE u.is_active = true 
        AND (
          u.player_id ILIKE $1 OR 
          CONCAT(u.given_name, ' ', u.family_name) ILIKE $1
        )
      `;
      
      const params = [`%${query}%`];
      let paramIndex = 2;

      if (excludeUserId) {
        whereClause += ` AND u.user_id != $${paramIndex}`;
        params.push(excludeUserId);
        paramIndex++;
      }

      const searchQuery = `
        SELECT 
          u.user_id,
          u.player_id,
          u.given_name,
          u.family_name,
          u.picture_url,
          us.rank_points,
          us.rank_tier,
          us.games_played,
          us.games_won
        FROM users u
        LEFT JOIN user_stats us ON u.user_id = us.user_id
        ${whereClause}
        ORDER BY us.rank_points DESC, us.games_won DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await this.db.query(searchQuery, params);
      
      return result.rows.map(row => ({
        userId: row.user_id,
        playerId: row.player_id,
        displayName: `${row.given_name} ${row.family_name}`.trim() || row.player_id,
        pictureUrl: row.picture_url,
        rankPoints: row.rank_points || 1000,
        rankTier: row.rank_tier || 'Bronze',
        gamesPlayed: row.games_played || 0,
        gamesWon: row.games_won || 0,
        winRate: row.games_played > 0 ? Math.round((row.games_won / row.games_played) * 100) : 0
      }));
      
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  }

  // Private helper methods

  formatUserProfile(row) {
    return {
      userId: row.user_id,
      playerId: row.player_id,
      email: row.email,
      givenName: row.given_name,
      familyName: row.family_name,
      displayName: `${row.given_name || ''} ${row.family_name || ''}`.trim() || row.player_id,
      pictureUrl: row.picture_url,
      authProvider: row.auth_provider,
      isActive: row.is_active,
      emailVerified: row.email_verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
      loginCount: row.login_count || 0,
      stats: {
        gamesPlayed: row.games_played || 0,
        gamesWon: row.games_won || 0,
        gamesLost: row.games_lost || 0,
        gamesDrawn: row.games_drawn || 0,
        totalScore: row.total_score || 0,
        rankPoints: row.rank_points || 1000,
        rankTier: row.rank_tier || 'Bronze',
        currentStreak: row.current_streak || 0,
        bestStreak: row.best_streak || 0,
        winRate: row.games_played > 0 ? Math.round((row.games_won / row.games_played) * 100) : 0,
        updatedAt: row.stats_updated_at
      }
    };
  }

  formatGameHistory(row, userId) {
    const isPlayer1 = row.player1_player_id === userId;
    const result = row.winner_id === userId ? 'win' : 
                   row.winner_id === null ? 'draw' : 'loss';

    return {
      gameId: row.game_id,
      status: row.status,
      result,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      opponent: {
        playerId: isPlayer1 ? row.player2_player_id : row.player1_player_id,
        name: isPlayer1 ? row.player2_name : row.player1_name
      },
      gameData: row.game_data
    };
  }

  validateProfileUpdates(updates) {
    const allowedFields = ['given_name', 'family_name', 'picture_url'];
    
    for (const field of Object.keys(updates)) {
      if (!allowedFields.includes(field)) {
        throw new ValidationError(`Field '${field}' is not allowed for update`);
      }
    }

    if (updates.given_name !== undefined) {
      if (typeof updates.given_name !== 'string' || updates.given_name.length > 50) {
        throw new ValidationError('Given name must be a string with max 50 characters');
      }
    }

    if (updates.family_name !== undefined) {
      if (typeof updates.family_name !== 'string' || updates.family_name.length > 50) {
        throw new ValidationError('Family name must be a string with max 50 characters');
      }
    }

    if (updates.picture_url !== undefined) {
      if (typeof updates.picture_url !== 'string' || updates.picture_url.length > 2048) {
        throw new ValidationError('Picture URL must be a string with max 2048 characters');
      }
    }
  }

  validateStatsUpdate(statsUpdate) {
    const numericFields = ['gamesPlayed', 'gamesWon', 'gamesLost', 'gamesDrawn', 'scoreChange', 'streakChange'];
    
    for (const field of numericFields) {
      if (statsUpdate[field] !== undefined && typeof statsUpdate[field] !== 'number') {
        throw new ValidationError(`${field} must be a number`);
      }
    }
  }

  validatePreferences(preferences) {
    if (typeof preferences !== 'object' || preferences === null) {
      throw new ValidationError('Preferences must be an object');
    }

    // Validate specific preference fields
    const validFields = [
      'theme', 'language', 'notifications', 'privacy', 'gameplay'
    ];

    for (const field of Object.keys(preferences)) {
      if (!validFields.includes(field)) {
        throw new ValidationError(`Invalid preference field: ${field}`);
      }
    }
  }

  calculateRankPointsChange(statsUpdate) {
    const { gamesWon = 0, gamesLost = 0, gamesDrawn = 0 } = statsUpdate;
    
    let pointsChange = 0;
    pointsChange += gamesWon * 25;      // +25 for win
    pointsChange += gamesLost * -20;    // -20 for loss
    pointsChange += gamesDrawn * 5;     // +5 for draw
    
    return pointsChange;
  }

  async updateRankTier(userId, rankPoints) {
    let tier = 'Bronze';
    
    if (rankPoints >= 2500) tier = 'Grandmaster';
    else if (rankPoints >= 2000) tier = 'Master';
    else if (rankPoints >= 1750) tier = 'Diamond';
    else if (rankPoints >= 1500) tier = 'Platinum';
    else if (rankPoints >= 1250) tier = 'Gold';
    else if (rankPoints >= 1000) tier = 'Silver';

    const query = `
      UPDATE user_stats 
      SET rank_tier = $1, updated_at = $2
      WHERE user_id = $3 AND rank_tier != $1
    `;

    await this.db.query(query, [tier, new Date(), userId]);
  }

  getDefaultPreferences() {
    return {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        gameInvites: true,
        achievements: true
      },
      privacy: {
        showOnlineStatus: true,
        showGameHistory: true,
        allowFriendRequests: true
      },
      gameplay: {
        autoAcceptRematches: false,
        showMoveHints: true,
        soundEffects: true
      }
    };
  }

  async invalidateUserCache(userId) {
    const keys = [
      `${this.cachePrefix}profile:${userId}`,
      `${this.cachePrefix}preferences:${userId}`,
      `${this.cachePrefix}leaderboard:${userId}`
    ];

    await Promise.all(keys.map(key => this.cache.del(key)));
  }
}

module.exports = UserService;