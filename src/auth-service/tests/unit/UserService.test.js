// Unit Tests for UserService
const UserService = require('../../src/services/UserService');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');

// Mock dependencies
const mockDbManager = {
  query: jest.fn()
};

const mockCacheManager = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn()
};

describe('UserService', () => {
  let userService;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService(mockDbManager, mockCacheManager);
  });

  describe('getUserProfile', () => {
    const mockUserData = {
      user_id: 'user123',
      player_id: 'player123',
      email: 'test@example.com',
      given_name: 'John',
      family_name: 'Doe',
      picture_url: 'https://example.com/avatar.jpg',
      auth_provider: 'Google',
      is_active: true,
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: new Date(),
      login_count: 5,
      games_played: 10,
      games_won: 7,
      games_lost: 2,
      games_drawn: 1,
      total_score: 150,
      rank_points: 1250,
      rank_tier: 'Gold',
      current_streak: 3,
      best_streak: 5
    };

    it('should return cached profile if available', async () => {
      const cachedProfile = JSON.stringify({ userId: 'user123', cached: true });
      mockCacheManager.get.mockResolvedValue(cachedProfile);

      const result = await userService.getUserProfile('user123');

      expect(result).toEqual({ userId: 'user123', cached: true });
      expect(mockCacheManager.get).toHaveBeenCalledWith('user:profile:user123');
      expect(mockDbManager.query).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache result if not cached', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockDbManager.query.mockResolvedValue({ rows: [mockUserData] });

      const result = await userService.getUserProfile('user123');

      expect(result.userId).toBe('user123');
      expect(result.playerId).toBe('player123');
      expect(result.displayName).toBe('John Doe');
      expect(result.stats.gamesPlayed).toBe(10);
      expect(result.stats.winRate).toBe(70);
      expect(mockCacheManager.setex).toHaveBeenCalled();
    });

    it('should throw NotFoundError if user not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockDbManager.query.mockResolvedValue({ rows: [] });

      await expect(userService.getUserProfile('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateUserProfile', () => {
    it('should update valid profile fields', async () => {
      const updates = {
        given_name: 'Jane',
        family_name: 'Smith',
        picture_url: 'https://example.com/new-avatar.jpg'
      };

      mockDbManager.query.mockResolvedValue({
        rows: [{ user_id: 'user123', ...updates, updated_at: new Date() }]
      });

      const result = await userService.updateUserProfile('user123', updates);

      expect(result.given_name).toBe('Jane');
      expect(mockDbManager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['Jane', 'Smith', 'https://example.com/new-avatar.jpg'])
      );
    });

    it('should validate profile updates', async () => {
      const invalidUpdates = {
        email: 'new@example.com', // Not allowed
        given_name: 'A'.repeat(51) // Too long
      };

      await expect(userService.updateUserProfile('user123', invalidUpdates))
        .rejects.toThrow(ValidationError);
    });

    it('should throw error if no valid fields to update', async () => {
      await expect(userService.updateUserProfile('user123', {}))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('updateUserStats', () => {
    it('should update user statistics correctly', async () => {
      const statsUpdate = {
        gamesPlayed: 1,
        gamesWon: 1,
        gamesLost: 0,
        gamesDrawn: 0,
        scoreChange: 25,
        streakChange: 1
      };

      mockDbManager.query.mockResolvedValueOnce({
        rows: [{
          user_id: 'user123',
          games_played: 11,
          games_won: 8,
          rank_points: 1275,
          current_streak: 4
        }]
      });

      // Mock rank tier update
      mockDbManager.query.mockResolvedValueOnce({ rows: [] });

      const result = await userService.updateUserStats('user123', statsUpdate);

      expect(result.games_played).toBe(11);
      expect(result.games_won).toBe(8);
      expect(mockDbManager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_stats'),
        expect.arrayContaining([1, 1, 0, 0, 25, 1, 25])
      );
    });

    it('should calculate rank points correctly', () => {
      const statsUpdate = {
        gamesWon: 1,
        gamesLost: 0,
        gamesDrawn: 0
      };

      const pointsChange = userService.calculateRankPointsChange(statsUpdate);
      expect(pointsChange).toBe(25); // +25 for win
    });
  });

  describe('getUserPreferences', () => {
    it('should return cached preferences if available', async () => {
      const cachedPrefs = JSON.stringify({ theme: 'dark' });
      mockCacheManager.get.mockResolvedValue(cachedPrefs);

      const result = await userService.getUserPreferences('user123');

      expect(result).toEqual({ theme: 'dark' });
    });

    it('should return default preferences if none exist', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockDbManager.query.mockResolvedValue({ rows: [] });

      const result = await userService.getUserPreferences('user123');

      expect(result).toHaveProperty('theme', 'dark');
      expect(result).toHaveProperty('language', 'en');
      expect(result.notifications).toHaveProperty('email', true);
    });
  });

  describe('searchUsers', () => {
    it('should search users by query', async () => {
      const mockUsers = [
        {
          user_id: 'user1',
          player_id: 'player1',
          given_name: 'John',
          family_name: 'Doe',
          rank_points: 1500,
          games_played: 20,
          games_won: 15
        }
      ];

      mockDbManager.query.mockResolvedValue({ rows: mockUsers });

      const result = await userService.searchUsers('john', { limit: 10 });

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('John Doe');
      expect(result[0].winRate).toBe(75);
    });
  });

  describe('getUserLeaderboardPosition', () => {
    it('should return user position and percentile', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockDbManager.query.mockResolvedValue({
        rows: [{
          position: 15,
          rank_points: 1500,
          total_players: 100
        }]
      });

      const result = await userService.getUserLeaderboardPosition('user123');

      expect(result.position).toBe(15);
      expect(result.percentile).toBe(85); // Top 15%
      expect(mockCacheManager.setex).toHaveBeenCalled();
    });
  });

  describe('validation methods', () => {
    it('should validate profile updates correctly', () => {
      expect(() => {
        userService.validateProfileUpdates({
          given_name: 'Valid Name',
          family_name: 'Valid Family'
        });
      }).not.toThrow();

      expect(() => {
        userService.validateProfileUpdates({
          invalid_field: 'value'
        });
      }).toThrow(ValidationError);
    });

    it('should validate preferences correctly', () => {
      const validPrefs = {
        theme: 'dark',
        notifications: { email: true }
      };

      expect(() => {
        userService.validatePreferences(validPrefs);
      }).not.toThrow();

      expect(() => {
        userService.validatePreferences('invalid');
      }).toThrow(ValidationError);
    });
  });

  describe('cache management', () => {
    it('should invalidate user cache correctly', async () => {
      await userService.invalidateUserCache('user123');

      expect(mockCacheManager.del).toHaveBeenCalledTimes(3);
      expect(mockCacheManager.del).toHaveBeenCalledWith('user:profile:user123');
      expect(mockCacheManager.del).toHaveBeenCalledWith('user:preferences:user123');
      expect(mockCacheManager.del).toHaveBeenCalledWith('user:leaderboard:user123');
    });
  });
});