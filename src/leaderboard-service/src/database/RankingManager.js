// Ranking Manager
// Handles all database operations for leaderboard rankings and statistics

const { Pool } = require('pg');
const config = require('../config');

class RankingManager {
  constructor() {
    this.pool = null;
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      this.pool = new Pool({
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
        max: config.database.maxConnections || 20,
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
      client.release();

      console.log('RankingManager initialized');
    } catch (error) {
      console.error('Failed to initialize RankingManager:', error);
      throw error;
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
      await client.query('BEGIN');
      await client.query('SELECT refresh_all_leaderboards()');
      await client.query('COMMIT');
      console.log('Leaderboards refreshed successfully');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error refreshing leaderboards:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get global leaderboard with pagination
   */
  async getGlobalLeaderboard(limit = 100, offset = 0) {
    try {
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
          ROUND((1 - percentile) * 100, 2) as top_percentage,
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
