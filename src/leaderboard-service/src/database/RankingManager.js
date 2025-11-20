// Ranking Manager
// Handles all database operations for leaderboard rankings and statistics

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

class RankingManager {
  constructor() {
    this.pool = null;
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      // Ensure password is a string
      const password = String(config.database.password || '');
      
      this.pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: password,
        max: config.database.pool?.max || 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl: config.database.ssl ? {
          rejectUnauthorized: false
        } : false
      });

      this.pool.on('error', (err) => {
        console.error('Unexpected database error:', err);
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      
      // Initialize schema if needed
      await this.initializeSchema(client);
      
      client.release();

      console.log('RankingManager initialized successfully');
      logger.info('Database connection established', {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name
      });
    } catch (error) {
      logger.error('Failed to initialize RankingManager', {
        error: error.message,
        code: error.code,
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        hasPassword: !!config.database.password,
        passwordLength: config.database.password ? config.database.password.length : 0
      });
      console.error('Failed to initialize RankingManager:', error);
      throw error;
    }
  }

  /**
   * Initialize database schema if tables don't exist
   */
  async initializeSchema(client) {
    try {
      logger.info('Checking database schema...');
      
      // Create users table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          display_name VARCHAR(100),
          avatar_url VARCHAR(500),
          region VARCHAR(50) DEFAULT 'UNKNOWN',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create user_stats table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_stats (
          user_id UUID PRIMARY KEY,
          games_played INTEGER DEFAULT 0,
          games_won INTEGER DEFAULT 0,
          games_lost INTEGER DEFAULT 0,
          games_drawn INTEGER DEFAULT 0,
          current_streak INTEGER DEFAULT 0,
          best_streak INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Check if we have any users, if not, create test data
      const result = await client.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(result.rows[0].count);
      
      if (userCount === 0) {
        logger.info('No users found, creating test data...');
        
        // Insert test users
        await client.query(`
          INSERT INTO users (username, email, display_name, region)
          VALUES 
            ('testplayer1', 'test1@example.com', 'Test Player 1', 'NA'),
            ('testplayer2', 'test2@example.com', 'Test Player 2', 'EU'),
            ('testplayer3', 'test3@example.com', 'Test Player 3', 'ASIA')
        `);
        
        // Insert test stats
        await client.query(`
          INSERT INTO user_stats (user_id, games_played, games_won, games_lost)
          SELECT user_id, 10, 7, 3 FROM users WHERE username = 'testplayer1'
        `);
        
        await client.query(`
          INSERT INTO user_stats (user_id, games_played, games_won, games_lost)
          SELECT user_id, 15, 10, 5 FROM users WHERE username = 'testplayer2'
        `);
        
        await client.query(`
          INSERT INTO user_stats (user_id, games_played, games_won, games_lost)
          SELECT user_id, 20, 12, 8 FROM users WHERE username = 'testplayer3'
        `);
        
        logger.info('Test data created successfully');
      }
      
      logger.info('Database schema initialized');
    } catch (error) {
      logger.error('Failed to initialize schema', { error: error.message });
      // Don't throw - service can still start even if schema init fails
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('RankingManager connection pool closed');
    }
  }

  /**
   * Refresh materialized views
   */
  async refreshLeaderboards() {
    const client = await this.pool.connect();
    try {
      // Check if the function exists first
      const checkResult = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_proc 
          WHERE proname = 'refresh_all_leaderboards'
        ) as exists
      `);
      
      if (!checkResult.rows[0].exists) {
        logger.warn('refresh_all_leaderboards() function does not exist, skipping refresh');
        return false;
      }
      
      await client.query('BEGIN');
      await client.query('SELECT refresh_all_leaderboards()');
      await client.query('COMMIT');
      console.log('Leaderboards refreshed successfully');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error refreshing leaderboards:', error);
      logger.error('Scheduled leaderboard refresh failed', {
        name: error.name,
        message: error.message,
        code: error.code,
        hint: error.hint,
        stack: error.stack
      });
      // Don't throw - just log and continue
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get global leaderboard with pagination
   */
  async getGlobalLeaderboard(limit = 100, offset = 0) {
    try {
      // Check if materialized view exists
      const checkView = await this.pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_matviews WHERE matviewname = 'global_leaderboard'
        ) as exists
      `);
      
      if (!checkView.rows[0].exists) {
        // Fallback to direct query if view doesn't exist
        logger.warn('global_leaderboard view does not exist, using fallback query');
        const fallbackQuery = `
          SELECT 
            u.user_id,
            u.username,
            u.display_name,
            u.avatar_url,
            us.games_played,
            us.games_won,
            us.games_lost,
            us.games_drawn,
            us.current_streak,
            us.best_streak,
            CASE 
              WHEN us.games_played > 0 
              THEN ROUND((us.games_won::DECIMAL / us.games_played) * 100, 2)
              ELSE 0 
            END as win_percentage,
            1200 + (us.games_won - us.games_lost) * 5 as rating,
            ROW_NUMBER() OVER (ORDER BY us.games_won DESC, us.games_played ASC) as global_rank,
            0 as top_percentage,
            us.updated_at as last_game_at
          FROM users u
          INNER JOIN user_stats us ON u.user_id = us.user_id
          WHERE u.is_active = TRUE AND us.games_played >= 5
          ORDER BY global_rank
          LIMIT $1 OFFSET $2
        `;
        const result = await this.pool.query(fallbackQuery, [limit, offset]);
        return result.rows;
      }
      
      const query = `
        SELECT 
          user_id,
          username,
          display_name,
          avatar_url,
          games_played,
          games_won,
          games_lost,
          games_drawn,
          win_percentage,
          rating,
          current_streak,
          best_streak,
          global_rank,
          ROUND(CAST((1 - percentile) * 100 AS NUMERIC), 2) as top_percentage,
          last_game_at
        FROM global_leaderboard
        ORDER BY global_rank
        LIMIT $1 OFFSET $2
      `;
      
      const result = await this.pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error getting global leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get regional leaderboard with pagination
   */
  async getRegionalLeaderboard(region, limit = 100, offset = 0) {
    try {
      const query = `
        SELECT 
          user_id,
          username,
          display_name,
          avatar_url,
          region,
          games_played,
          games_won,
          games_lost,
          games_drawn,
          win_percentage,
          rating,
          current_streak,
          best_streak,
          regional_rank,
          ROUND((1 - regional_percentile) * 100, 2) as regional_top_percentage,
          last_game_at
        FROM regional_leaderboard
        WHERE region = $1
        ORDER BY regional_rank
        LIMIT $2 OFFSET $3
      `;
      
      const result = await this.pool.query(query, [region, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error getting regional leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get user's leaderboard position
   */
  async getUserPosition(userId) {
    try {
      const query = `
        SELECT * FROM get_user_leaderboard_position($1)
      `;
      
      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting user position:', error);
      throw error;
    }
  }

  /**
   * Get players around a specific rank
   */
  async getPlayersAroundRank(rank, range = 10) {
    try {
      const query = `
        SELECT 
          user_id,
          username,
          display_name,
          avatar_url,
          games_played,
          games_won,
          win_percentage,
          rating,
          current_streak,
          global_rank
        FROM global_leaderboard
        WHERE global_rank BETWEEN $1 - $2 AND $1 + $2
        ORDER BY global_rank
      `;
      
      const result = await this.pool.query(query, [rank, range]);
      return result.rows;
    } catch (error) {
      console.error('Error getting players around rank:', error);
      throw error;
    }
  }

  /**
   * Get all regions with player counts
   */
  async getRegions() {
    try {
      const query = `
        SELECT 
          region,
          COUNT(*) as player_count,
          AVG(win_percentage) as avg_win_rate,
          MAX(rating) as top_rating
        FROM regional_leaderboard
        GROUP BY region
        ORDER BY player_count DESC
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting regions:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard statistics
   */
  async getLeaderboardStatistics() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_players,
          SUM(games_played) as total_games,
          AVG(win_percentage) as avg_win_rate,
          MAX(rating) as highest_rating,
          MIN(rating) as lowest_rating,
          AVG(rating) as avg_rating,
          MAX(current_streak) as longest_current_streak,
          MAX(best_streak) as longest_ever_streak
        FROM global_leaderboard
      `;
      
      const result = await this.pool.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting leaderboard statistics:', error);
      throw error;
    }
  }

  /**
   * Get top performers by different metrics
   */
  async getTopPerformers(metric, limit = 10) {
    try {
      let query;
      
      switch (metric) {
        case 'win_rate':
          query = `
            SELECT 
              user_id,
              username,
              display_name,
              games_played,
              games_won,
              win_percentage,
              global_rank
            FROM global_leaderboard
            WHERE games_played >= 20
            ORDER BY win_percentage DESC, games_won DESC
            LIMIT $1
          `;
          break;
          
        case 'streak':
          query = `
            SELECT 
              user_id,
              username,
              display_name,
              current_streak,
              games_played,
              win_percentage,
              global_rank
            FROM global_leaderboard
            WHERE current_streak > 0
            ORDER BY current_streak DESC
            LIMIT $1
          `;
          break;
          
        case 'wins':
          query = `
            SELECT 
              user_id,
              username,
              display_name,
              games_won,
              games_played,
              win_percentage,
              global_rank
            FROM global_leaderboard
            ORDER BY games_won DESC
            LIMIT $1
          `;
          break;
          
        case 'games':
          query = `
            SELECT 
              user_id,
              username,
              display_name,
              games_played,
              games_won,
              win_percentage,
              global_rank
            FROM global_leaderboard
            ORDER BY games_played DESC
            LIMIT $1
          `;
          break;
          
        default:
          throw new Error(`Invalid metric: ${metric}`);
      }
      
      const result = await this.pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting top performers:', error);
      throw error;
    }
  }

  /**
   * Search players by username
   */
  async searchPlayers(searchTerm, limit = 50) {
    try {
      const query = `
        SELECT 
          user_id,
          username,
          display_name,
          avatar_url,
          games_played,
          games_won,
          win_percentage,
          rating,
          global_rank
        FROM global_leaderboard
        WHERE username ILIKE $1
           OR display_name ILIKE $1
        ORDER BY global_rank
        LIMIT $2
      `;
      
      const searchPattern = `%${searchTerm}%`;
      const result = await this.pool.query(query, [searchPattern, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error searching players:', error);
      throw error;
    }
  }

  /**
   * Get user's rank history
   */
  async getUserRankHistory(userId, days = 30) {
    try {
      const query = `
        SELECT 
          snapshot_date,
          global_rank,
          regional_rank,
          games_played,
          games_won,
          win_percentage,
          rating,
          current_streak
        FROM leaderboard_history
        WHERE user_id = $1
          AND snapshot_date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY snapshot_date DESC
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user rank history:', error);
      throw error;
    }
  }

  /**
   * Get rank changes for a user
   */
  async getUserRankChanges(userId) {
    try {
      const query = `
        WITH ranked_history AS (
          SELECT 
            snapshot_date,
            global_rank,
            LAG(global_rank) OVER (ORDER BY snapshot_date) as prev_rank
          FROM leaderboard_history
          WHERE user_id = $1
          ORDER BY snapshot_date DESC
          LIMIT 30
        )
        SELECT 
          snapshot_date,
          global_rank,
          prev_rank,
          CASE 
            WHEN prev_rank IS NULL THEN 0
            ELSE prev_rank - global_rank
          END as rank_change
        FROM ranked_history
        ORDER BY snapshot_date DESC
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user rank changes:', error);
      throw error;
    }
  }

  /**
   * Get top climbers (biggest rank improvements)
   */
  async getTopClimbers(days = 7, limit = 10) {
    try {
      const query = `
        WITH recent_ranks AS (
          SELECT 
            user_id,
            global_rank,
            snapshot_date,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY snapshot_date DESC) as rn
          FROM leaderboard_history
          WHERE snapshot_date >= CURRENT_DATE - INTERVAL '${days} days'
        )
        SELECT 
          u.username,
          u.display_name,
          current.global_rank as current_rank,
          previous.global_rank as previous_rank,
          previous.global_rank - current.global_rank as rank_improvement
        FROM recent_ranks current
        JOIN recent_ranks previous ON current.user_id = previous.user_id
        JOIN users u ON current.user_id = u.user_id
        WHERE current.rn = 1 AND previous.rn = (
          SELECT MAX(rn) FROM recent_ranks WHERE user_id = current.user_id
        )
        AND previous.global_rank - current.global_rank > 0
        ORDER BY rank_improvement DESC
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting top climbers:', error);
      throw error;
    }
  }

  /**
   * Compare two players
   */
  async comparePlayers(userId1, userId2) {
    try {
      const query = `
        SELECT 
          user_id,
          username,
          display_name,
          global_rank,
          games_played,
          games_won,
          games_lost,
          games_drawn,
          win_percentage,
          rating,
          current_streak,
          best_streak
        FROM global_leaderboard
        WHERE user_id IN ($1, $2)
        ORDER BY global_rank
      `;
      
      const result = await this.pool.query(query, [userId1, userId2]);
      return result.rows;
    } catch (error) {
      console.error('Error comparing players:', error);
      throw error;
    }
  }

  /**
   * Capture daily leaderboard snapshot
   */
  async captureSnapshot() {
    try {
      const query = 'SELECT capture_leaderboard_snapshot()';
      const result = await this.pool.query(query);
      const rowsInserted = result.rows[0].capture_leaderboard_snapshot;
      console.log(`Captured leaderboard snapshot: ${rowsInserted} rows`);
      return rowsInserted;
    } catch (error) {
      console.error('Error capturing snapshot:', error);
      throw error;
    }
  }

  /**
   * Clean expired cache entries from database
   */
  async cleanExpiredCache() {
    try {
      const query = 'SELECT clean_expired_cache()';
      const result = await this.pool.query(query);
      const rowsDeleted = result.rows[0].clean_expired_cache;
      console.log(`Cleaned expired cache: ${rowsDeleted} rows`);
      return rowsDeleted;
    } catch (error) {
      console.error('Error cleaning expired cache:', error);
      throw error;
    }
  }

  /**
   * Get database health status
   */
  async healthCheck() {
    try {
      const result = await this.pool.query('SELECT NOW()');
      return {
        healthy: true,
        timestamp: result.rows[0].now
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const queries = {
        tableSize: `
          SELECT 
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
          FROM pg_tables
          WHERE tablename IN ('leaderboard_history', 'leaderboard_cache')
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `,
        matviewStatus: `
          SELECT 
            matviewname,
            ispopulated,
            definition
          FROM pg_matviews
          WHERE matviewname IN ('global_leaderboard', 'regional_leaderboard')
        `
      };

      const [tableSizeResult, matviewResult] = await Promise.all([
        this.pool.query(queries.tableSize),
        this.pool.query(queries.matviewStatus)
      ]);

      return {
        tableSizes: tableSizeResult.rows,
        materializedViews: matviewResult.rows
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }
}

module.exports = RankingManager;
