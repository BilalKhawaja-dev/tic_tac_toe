// Leaderboard Cache Manager
// Handles caching of leaderboard data using Redis for performance optimization

const Redis = require('ioredis');
const config = require('../config');

class LeaderboardCache {
  constructor() {
    this.redis = null;
    this.defaultTTL = config.cache.defaultTTL || 300; // 5 minutes default
    this.keyPrefix = 'leaderboard:';
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || '',
        db: config.redis.db || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,  // Disable ready check
        lazyConnect: true,  // Don't connect immediately
        connectTimeout: 5000
      });

      this.redis.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      this.redis.on('connect', () => {
        console.log('Redis connected successfully');
      });

      this.redis.on('ready', () => {
        console.log('Redis ready');
      });

      // Connect in background, don't wait
      this.redis.connect().catch((err) => {
        console.error('Redis connection failed, will retry:', err.message);
      });
      
      console.log('LeaderboardCache initialized (connecting in background)');
      return true;
    } catch (error) {
      console.error('Failed to initialize LeaderboardCache:', error);
      // Don't throw - allow service to start without cache
      console.log('Service will continue without cache');
      return true;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      console.log('LeaderboardCache connection closed');
    }
  }

  /**
   * Generate cache key with prefix
   */
  _generateKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get cached data
   */
  async get(key) {
    try {
      const cacheKey = this._generateKey(key);
      const data = await this.redis.get(cacheKey);
      
      if (data) {
        return JSON.parse(data);
      }
      
      return null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null; // Return null on error to allow fallback to database
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key, data, ttl = null) {
    try {
      const cacheKey = this._generateKey(key);
      const serializedData = JSON.stringify(data);
      const cacheTTL = ttl || this.defaultTTL;
      
      await this.redis.setex(cacheKey, cacheTTL, serializedData);
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async delete(key) {
    try {
      const cacheKey = this._generateKey(key);
      await this.redis.del(cacheKey);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern) {
    try {
      const cachePattern = this._generateKey(pattern);
      const keys = await this.redis.keys(cachePattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      return keys.length;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate all leaderboard caches
   */
  async invalidateAll() {
    try {
      const deleted = await this.deletePattern('*');
      console.log(`Invalidated ${deleted} cache entries`);
      return deleted;
    } catch (error) {
      console.error('Cache invalidate all error:', error);
      return 0;
    }
  }

  /**
   * Get global leaderboard from cache
   */
  async getGlobalLeaderboard(limit = 100, offset = 0) {
    const key = `global:${limit}:${offset}`;
    return await this.get(key);
  }

  /**
   * Set global leaderboard in cache
   */
  async setGlobalLeaderboard(data, limit = 100, offset = 0, ttl = null) {
    const key = `global:${limit}:${offset}`;
    return await this.set(key, data, ttl);
  }

  /**
   * Get regional leaderboard from cache
   */
  async getRegionalLeaderboard(region, limit = 100, offset = 0) {
    const key = `regional:${region}:${limit}:${offset}`;
    return await this.get(key);
  }

  /**
   * Set regional leaderboard in cache
   */
  async setRegionalLeaderboard(region, data, limit = 100, offset = 0, ttl = null) {
    const key = `regional:${region}:${limit}:${offset}`;
    return await this.set(key, data, ttl);
  }

  /**
   * Get user position from cache
   */
  async getUserPosition(userId) {
    const key = `user:${userId}:position`;
    return await this.get(key);
  }

  /**
   * Set user position in cache
   */
  async setUserPosition(userId, data, ttl = null) {
    const key = `user:${userId}:position`;
    return await this.set(key, data, ttl);
  }

  /**
   * Invalidate user-specific caches
   */
  async invalidateUser(userId) {
    const pattern = `user:${userId}:*`;
    return await this.deletePattern(pattern);
  }

  /**
   * Invalidate regional caches
   */
  async invalidateRegion(region) {
    const pattern = `regional:${region}:*`;
    return await this.deletePattern(pattern);
  }

  /**
   * Get leaderboard statistics from cache
   */
  async getStatistics() {
    const key = 'statistics';
    return await this.get(key);
  }

  /**
   * Set leaderboard statistics in cache
   */
  async setStatistics(data, ttl = null) {
    const key = 'statistics';
    return await this.set(key, data, ttl);
  }

  /**
   * Get top performers by metric from cache
   */
  async getTopPerformers(metric, limit = 10) {
    const key = `top:${metric}:${limit}`;
    return await this.get(key);
  }

  /**
   * Set top performers in cache
   */
  async setTopPerformers(metric, data, limit = 10, ttl = null) {
    const key = `top:${metric}:${limit}`;
    return await this.set(key, data, ttl);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const info = await this.redis.info('stats');
      const keyspace = await this.redis.info('keyspace');
      
      // Parse Redis info output
      const stats = {
        connected: this.redis.status === 'ready',
        totalKeys: 0,
        leaderboardKeys: 0,
        memoryUsed: 0,
        hits: 0,
        misses: 0
      };

      // Extract keyspace info
      const keyspaceMatch = keyspace.match(/keys=(\d+)/);
      if (keyspaceMatch) {
        stats.totalKeys = parseInt(keyspaceMatch[1]);
      }

      // Count leaderboard-specific keys
      const leaderboardKeys = await this.redis.keys(this._generateKey('*'));
      stats.leaderboardKeys = leaderboardKeys.length;

      // Extract stats info
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      
      if (hitsMatch) stats.hits = parseInt(hitsMatch[1]);
      if (missesMatch) stats.misses = parseInt(missesMatch[1]);

      if (stats.hits + stats.misses > 0) {
        stats.hitRate = (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2);
      } else {
        stats.hitRate = 0;
      }

      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(rankingManager) {
    try {
      console.log('Starting cache warm-up...');
      
      // Cache top 100 global leaderboard
      const globalTop100 = await rankingManager.getGlobalLeaderboard(100, 0);
      await this.setGlobalLeaderboard(globalTop100, 100, 0);
      
      // Cache statistics
      const stats = await rankingManager.getLeaderboardStatistics();
      await this.setStatistics(stats);
      
      // Cache top performers
      const topByWinRate = await rankingManager.getTopPerformers('win_rate', 10);
      await this.setTopPerformers('win_rate', topByWinRate, 10);
      
      const topByStreak = await rankingManager.getTopPerformers('streak', 10);
      await this.setTopPerformers('streak', topByStreak, 10);
      
      console.log('Cache warm-up completed');
      return true;
    } catch (error) {
      console.error('Cache warm-up error:', error);
      return false;
    }
  }

  /**
   * Check if cache is healthy
   */
  async healthCheck() {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }
}

module.exports = LeaderboardCache;
