// Integration Tests for Leaderboard API
// Tests complete API endpoints with mocked dependencies

const request = require('supertest');
const LeaderboardService = require('../../src/index');

// Mock dependencies
jest.mock('../../src/database/RankingManager');
jest.mock('../../src/cache/LeaderboardCache');
jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

const RankingManager = require('../../src/database/RankingManager');
const LeaderboardCache = require('../../src/cache/LeaderboardCache');

describe('Leaderboard API Integration Tests', () => {
  let app;
  let service;
  let mockRankingManager;
  let mockCache;

  beforeAll(async () => {
    // Setup mocks
    mockRankingManager = {
      initialize: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
      getGlobalLeaderboard: jest.fn(),
      getRegionalLeaderboard: jest.fn(),
      getUserPosition: jest.fn(),
      getRegions: jest.fn(),
      getLeaderboardStatistics: jest.fn(),
      getTopPerformers: jest.fn(),
      searchPlayers: jest.fn(),
      getUserRankHistory: jest.fn(),
      getUserRankChanges: jest.fn(),
      getTopClimbers: jest.fn(),
      comparePlayers: jest.fn(),
      refreshLeaderboards: jest.fn(),
      healthCheck: jest.fn(),
      getDatabaseStats: jest.fn()
    };

    mockCache = {
      initialize: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      invalidateAll: jest.fn().mockResolvedValue(0),
      healthCheck: jest.fn().mockResolvedValue(true),
      getCacheStats: jest.fn()
    };

    RankingManager.mockImplementation(() => mockRankingManager);
    LeaderboardCache.mockImplementation(() => mockCache);

    // Create service
    service = new LeaderboardService();
    await service.initialize();
    app = service.app;
  });

  afterAll(async () => {
    if (service) {
      await service.shutdown(0);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      mockRankingManager.healthCheck.mockResolvedValue({
        healthy: true,
        timestamp: new Date()
      });
      mockCache.healthCheck.mockResolvedValue(true);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.checks.database.healthy).toBe(true);
      expect(response.body.checks.cache.healthy).toBe(true);
    });

    it('should return unhealthy status when database is down', async () => {
      mockRankingManager.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Connection failed'
      });
      mockCache.healthCheck.mockResolvedValue(true);

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('GET /api/leaderboard/global', () => {
    it('should return global leaderboard with default pagination', async () => {
      const mockLeaderboard = [
        { user_id: 'user1', username: 'player1', global_rank: 1, win_percentage: 75.5 },
        { user_id: 'user2', username: 'player2', global_rank: 2, win_percentage: 70.2 }
      ];
      mockRankingManager.getGlobalLeaderboard.mockResolvedValue(mockLeaderboard);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toEqual(mockLeaderboard);
      expect(response.body.data.pagination.limit).toBe(100);
      expect(response.body.data.pagination.offset).toBe(0);
    });

    it('should support custom pagination', async () => {
      mockRankingManager.getGlobalLeaderboard.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/leaderboard/global?limit=50&offset=100')
        .expect(200);

      expect(mockRankingManager.getGlobalLeaderboard).toHaveBeenCalledWith(50, 100);
      expect(response.body.data.pagination.limit).toBe(50);
      expect(response.body.data.pagination.offset).toBe(100);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/leaderboard/global?limit=-1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('ValidationError');
    });

    it('should return cached data when available', async () => {
      const cachedData = [{ user_id: 'user1', global_rank: 1 }];
      mockCache.get.mockResolvedValue(cachedData);

      const response = await request(app)
        .get('/api/leaderboard/global')
        .expect(200);

      expect(response.body.data).toEqual(cachedData);
      expect(response.body.cached).toBe(true);
      expect(mockRankingManager.getGlobalLeaderboard).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/leaderboard/regional/:region', () => {
    it('should return regional leaderboard', async () => {
      const mockLeaderboard = [
        { user_id: 'user1', username: 'player1', region: 'EU', regional_rank: 1 }
      ];
      mockRankingManager.getRegionalLeaderboard.mockResolvedValue(mockLeaderboard);

      const response = await request(app)
        .get('/api/leaderboard/regional/EU')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.region).toBe('EU');
      expect(response.body.data.leaderboard).toEqual(mockLeaderboard);
    });

    it('should validate region parameter', async () => {
      const response = await request(app)
        .get('/api/leaderboard/regional/INVALID')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/leaderboard/user/:userId', () => {
    it('should return user position', async () => {
      const mockPosition = {
        global_rank: 42,
        regional_rank: 10,
        region: 'EU',
        total_players: 1000
      };
      mockRankingManager.getUserPosition.mockResolvedValue(mockPosition);

      const response = await request(app)
        .get('/api/leaderboard/user/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPosition);
    });

    it('should return 404 for non-existent user', async () => {
      mockRankingManager.getUserPosition.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/leaderboard/user/123e4567-e89b-12d3-a456-426614174000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NotFoundError');
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .get('/api/leaderboard/user/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/leaderboard/statistics', () => {
    it('should return leaderboard statistics', async () => {
      const mockStats = {
        total_players: 1000,
        total_games: 50000,
        avg_win_rate: 50.5
      };
      mockRankingManager.getLeaderboardStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/leaderboard/statistics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('GET /api/leaderboard/top/:metric', () => {
    it('should return top performers by win rate', async () => {
      const mockPerformers = [
        { user_id: 'user1', username: 'player1', win_percentage: 85.5 }
      ];
      mockRankingManager.getTopPerformers.mockResolvedValue(mockPerformers);

      const response = await request(app)
        .get('/api/leaderboard/top/win_rate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metric).toBe('win_rate');
      expect(response.body.data.players).toEqual(mockPerformers);
    });

    it('should validate metric parameter', async () => {
      const response = await request(app)
        .get('/api/leaderboard/top/invalid_metric')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should support custom limit', async () => {
      mockRankingManager.getTopPerformers.mockResolvedValue([]);

      await request(app)
        .get('/api/leaderboard/top/wins?limit=20')
        .expect(200);

      expect(mockRankingManager.getTopPerformers).toHaveBeenCalledWith('wins', 20);
    });
  });

  describe('GET /api/leaderboard/search', () => {
    it('should search players by username', async () => {
      const mockResults = [
        { user_id: 'user1', username: 'player1', global_rank: 10 }
      ];
      mockRankingManager.searchPlayers.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/leaderboard/search?q=player')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.query).toBe('player');
      expect(response.body.data.results).toEqual(mockResults);
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/leaderboard/search')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate minimum search length', async () => {
      const response = await request(app)
        .get('/api/leaderboard/search?q=a')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/leaderboard/compare', () => {
    it('should compare two players', async () => {
      const mockComparison = [
        { user_id: 'user1', username: 'player1', global_rank: 10 },
        { user_id: 'user2', username: 'player2', global_rank: 20 }
      ];
      mockRankingManager.comparePlayers.mockResolvedValue(mockComparison);

      const response = await request(app)
        .get('/api/leaderboard/compare?userId1=123e4567-e89b-12d3-a456-426614174000&userId2=223e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.players).toEqual(mockComparison);
    });

    it('should return 404 if players not found', async () => {
      mockRankingManager.comparePlayers.mockResolvedValue([{ user_id: 'user1' }]);

      const response = await request(app)
        .get('/api/leaderboard/compare?userId1=123e4567-e89b-12d3-a456-426614174000&userId2=223e4567-e89b-12d3-a456-426614174000')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/leaderboard/refresh', () => {
    it('should refresh leaderboards', async () => {
      mockRankingManager.refreshLeaderboards.mockResolvedValue(true);
      mockCache.invalidateAll.mockResolvedValue(10);

      const response = await request(app)
        .post('/api/leaderboard/refresh')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('refreshed');
      expect(mockRankingManager.refreshLeaderboards).toHaveBeenCalled();
      expect(mockCache.invalidateAll).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors', async () => {
      mockRankingManager.getGlobalLeaderboard.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/leaderboard/global')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/leaderboard/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('Rate limiting', () => {
    it('should enforce rate limits', async () => {
      mockRankingManager.getGlobalLeaderboard.mockResolvedValue([]);

      // Make requests up to the limit
      const requests = [];
      for (let i = 0; i < 101; i++) {
        requests.push(request(app).get('/api/leaderboard/global'));
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      // At least one request should be rate limited
      expect(rateLimited.length).toBeGreaterThan(0);
    }, 10000);
  });
});
