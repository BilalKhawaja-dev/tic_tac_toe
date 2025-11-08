// Unit Tests for LeaderboardCache
// Tests Redis caching operations

const LeaderboardCache = require('../../src/cache/LeaderboardCache');

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    info: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    status: 'ready'
  }));
});

describe('LeaderboardCache', () => {
  let cache;
  let mockRedis;

  beforeEach(async () => {
    jest.clearAllMocks();
    cache = new LeaderboardCache();
    await cache.initialize();
    mockRedis = cache.redis;
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('initialize', () => {
    it('should initialize Redis connection', async () => {
      expect(mockRedis.ping).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should retrieve cached data', async () => {
      const mockData = { rank: 1, username: 'player1' };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await cache.get('test-key');

      expect(result).toEqual(mockData);
      expect(mockRedis.get).toHaveBeenCalledWith('leaderboard:test-key');
    });

    it('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cache.get('error-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should cache data with default TTL', async () => {
      const mockData = { rank: 1, username: 'player1' };
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cache.set('test-key', mockData);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'leaderboard:test-key',
        300, // default TTL
        JSON.stringify(mockData)
      );
    });

    it('should cache data with custom TTL', async () => {
      const mockData = { rank: 1 };
      mockRedis.setex.mockResolvedValue('OK');

      await cache.set('test-key', mockData, 600);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'leaderboard:test-key',
        600,
        JSON.stringify(mockData)
      );
    });

    it('should handle errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await cache.set('error-key', {});

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete cached data', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cache.delete('test-key');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('leaderboard:test-key');
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedis.keys.mockResolvedValue([
        'leaderboard:user:1',
        'leaderboard:user:2'
      ]);
      mockRedis.del.mockResolvedValue(2);

      const result = await cache.deletePattern('user:*');

      expect(result).toBe(2);
      expect(mockRedis.keys).toHaveBeenCalledWith('leaderboard:user:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'leaderboard:user:1',
        'leaderboard:user:2'
      );
    });

    it('should handle no matching keys', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await cache.deletePattern('nonexistent:*');

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidateAll', () => {
    it('should invalidate all cache entries', async () => {
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockRedis.del.mockResolvedValue(3);

      const result = await cache.invalidateAll();

      expect(result).toBe(3);
    });
  });

  describe('getGlobalLeaderboard', () => {
    it('should retrieve global leaderboard from cache', async () => {
      const mockData = [{ rank: 1 }];
      mockRedis.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await cache.getGlobalLeaderboard(100, 0);

      expect(result).toEqual(mockData);
      expect(mockRedis.get).toHaveBeenCalledWith('leaderboard:global:100:0');
    });
  });

  describe('setGlobalLeaderboard', () => {
    it('should cache global leaderboard', async () => {
      const mockData = [{ rank: 1 }];
      mockRedis.setex.mockResolvedValue('OK');

      await cache.setGlobalLeaderboard(mockData, 100, 0);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'leaderboard:global:100:0',
        300,
        JSON.stringify(mockData)
      );
    });
  });

  describe('getUserPosition', () => {
    it('should retrieve user position from cache', async () => {
      const mockData = { rank: 42 };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await cache.getUserPosition('user123');

      expect(result).toEqual(mockData);
      expect(mockRedis.get).toHaveBeenCalledWith('leaderboard:user:user123:position');
    });
  });

  describe('invalidateUser', () => {
    it('should invalidate user-specific caches', async () => {
      mockRedis.keys.mockResolvedValue(['leaderboard:user:user123:position']);
      mockRedis.del.mockResolvedValue(1);

      const result = await cache.invalidateUser('user123');

      expect(result).toBe(1);
      expect(mockRedis.keys).toHaveBeenCalledWith('leaderboard:user:user123:*');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.info.mockResolvedValueOnce('keyspace_hits:1000\nkeyspace_misses:100');
      mockRedis.info.mockResolvedValueOnce('keys=50');
      mockRedis.keys.mockResolvedValue(new Array(25));

      const result = await cache.getCacheStats();

      expect(result).toHaveProperty('connected', true);
      expect(result).toHaveProperty('hits', 1000);
      expect(result).toHaveProperty('misses', 100);
      expect(result).toHaveProperty('hitRate', '90.91');
    });
  });

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await cache.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await cache.healthCheck();

      expect(result).toBe(false);
    });
  });
});
