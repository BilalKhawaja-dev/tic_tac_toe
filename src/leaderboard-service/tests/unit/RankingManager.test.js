// Unit Tests for RankingManager
// Tests database operations for leaderboard rankings

const RankingManager = require('../../src/database/RankingManager');

// Mock pg module
jest.mock('pg', () => {
  const mockPool = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
  };
  return { Pool: jest.fn(() => mockPool) };
});

describe('RankingManager', () => {
  let rankingManager;
  let mockPool;

  beforeEach(() => {
    jest.clearAllMocks();
    rankingManager = new RankingManager();
    const { Pool } = require('pg');
    mockPool = new Pool();
  });

  describe('initialize', () => {
    it('should initialize database connection pool', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);

      await rankingManager.initialize();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT NOW()');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(rankingManager.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('refreshLeaderboards', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should refresh materialized views', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);

      await rankingManager.refreshLeaderboards();

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT refresh_all_leaderboards()');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockRejectedValueOnce(new Error('Refresh failed')), // refresh_all_leaderboards
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);

      await expect(rankingManager.refreshLeaderboards()).rejects.toThrow('Refresh failed');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getGlobalLeaderboard', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should return global leaderboard with default pagination', async () => {
      const mockLeaderboard = [
        { user_id: 'user1', username: 'player1', global_rank: 1, win_percentage: 75.5 },
        { user_id: 'user2', username: 'player2', global_rank: 2, win_percentage: 70.2 }
      ];
      mockPool.query.mockResolvedValue({ rows: mockLeaderboard });

      const result = await rankingManager.getGlobalLeaderboard();

      expect(result).toEqual(mockLeaderboard);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM global_leaderboard'),
        [100, 0]
      );
    });

    it('should support custom pagination', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await rankingManager.getGlobalLeaderboard(50, 100);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [50, 100]
      );
    });
  });

  describe('getRegionalLeaderboard', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should return regional leaderboard', async () => {
      const mockLeaderboard = [
        { user_id: 'user1', username: 'player1', region: 'EU', regional_rank: 1 }
      ];
      mockPool.query.mockResolvedValue({ rows: mockLeaderboard });

      const result = await rankingManager.getRegionalLeaderboard('EU', 100, 0);

      expect(result).toEqual(mockLeaderboard);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM regional_leaderboard'),
        ['EU', 100, 0]
      );
    });
  });

  describe('getUserPosition', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should return user position', async () => {
      const mockPosition = {
        global_rank: 42,
        regional_rank: 10,
        region: 'EU',
        total_players: 1000,
        percentile: 0.95
      };
      mockPool.query.mockResolvedValue({ rows: [mockPosition] });

      const result = await rankingManager.getUserPosition('user123');

      expect(result).toEqual(mockPosition);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('get_user_leaderboard_position'),
        ['user123']
      );
    });

    it('should return null for non-existent user', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await rankingManager.getUserPosition('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getLeaderboardStatistics', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should return leaderboard statistics', async () => {
      const mockStats = {
        total_players: 1000,
        total_games: 50000,
        avg_win_rate: 50.5,
        highest_rating: 2000,
        lowest_rating: 1000
      };
      mockPool.query.mockResolvedValue({ rows: [mockStats] });

      const result = await rankingManager.getLeaderboardStatistics();

      expect(result).toEqual(mockStats);
    });
  });

  describe('getTopPerformers', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should return top performers by win rate', async () => {
      const mockPerformers = [
        { user_id: 'user1', username: 'player1', win_percentage: 85.5 }
      ];
      mockPool.query.mockResolvedValue({ rows: mockPerformers });

      const result = await rankingManager.getTopPerformers('win_rate', 10);

      expect(result).toEqual(mockPerformers);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('win_percentage DESC'),
        [10]
      );
    });

    it('should return top performers by streak', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await rankingManager.getTopPerformers('streak', 10);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('current_streak DESC'),
        [10]
      );
    });

    it('should throw error for invalid metric', async () => {
      await expect(rankingManager.getTopPerformers('invalid', 10))
        .rejects.toThrow('Invalid metric');
    });
  });

  describe('searchPlayers', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should search players by username', async () => {
      const mockResults = [
        { user_id: 'user1', username: 'player1', global_rank: 10 }
      ];
      mockPool.query.mockResolvedValue({ rows: mockResults });

      const result = await rankingManager.searchPlayers('player', 50);

      expect(result).toEqual(mockResults);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        ['%player%', 50]
      );
    });
  });

  describe('comparePlayers', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should compare two players', async () => {
      const mockComparison = [
        { user_id: 'user1', username: 'player1', global_rank: 10 },
        { user_id: 'user2', username: 'player2', global_rank: 20 }
      ];
      mockPool.query.mockResolvedValue({ rows: mockComparison });

      const result = await rankingManager.comparePlayers('user1', 'user2');

      expect(result).toEqual(mockComparison);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id IN'),
        ['user1', 'user2']
      );
    });
  });

  describe('captureSnapshot', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should capture daily snapshot', async () => {
      mockPool.query.mockResolvedValue({ 
        rows: [{ capture_leaderboard_snapshot: 1000 }] 
      });

      const result = await rankingManager.captureSnapshot();

      expect(result).toBe(1000);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT capture_leaderboard_snapshot()'
      );
    });
  });

  describe('healthCheck', () => {
    beforeEach(async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();
    });

    it('should return healthy status', async () => {
      const now = new Date();
      mockPool.query.mockResolvedValue({ rows: [{ now }] });

      const result = await rankingManager.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.timestamp).toEqual(now);
    });

    it('should return unhealthy status on error', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const result = await rankingManager.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('close', () => {
    it('should close database connection pool', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient);
      await rankingManager.initialize();

      await rankingManager.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});
