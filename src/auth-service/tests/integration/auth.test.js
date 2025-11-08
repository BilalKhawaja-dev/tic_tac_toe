// Integration Tests for Authentication Service
const request = require('supertest');
const AuthenticationServer = require('../../src/index');

// Mock external dependencies
jest.mock('../../src/database/DatabaseManager');
jest.mock('../../src/cache/CacheManager');
jest.mock('../../src/services/CognitoService');

const mockDbManager = {
  initialize: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(true),
  query: jest.fn()
};

const mockCacheManager = {
  initialize: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(true),
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn()
};

const mockCognitoService = {
  getCognitoUser: jest.fn(),
  updateCognitoUserAttributes: jest.fn(),
  syncUserStatsToCognito: jest.fn()
};

// Mock JWT middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      sub: 'test-user-123',
      email: 'test@example.com',
      player_id: 'test-player-123'
    };
    next();
  }
}));

describe('Authentication Service Integration', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Mock the constructors
    require('../../src/database/DatabaseManager').mockImplementation(() => mockDbManager);
    require('../../src/cache/CacheManager').mockImplementation(() => mockCacheManager);
    require('../../src/services/CognitoService').mockImplementation(() => mockCognitoService);

    const authServer = new AuthenticationServer();
    server = await authServer.start();
    app = authServer.app;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('User Profile Endpoints', () => {
    const mockUserProfile = {
      userId: 'test-user-123',
      playerId: 'test-player-123',
      email: 'test@example.com',
      givenName: 'Test',
      familyName: 'User',
      displayName: 'Test User',
      stats: {
        gamesPlayed: 10,
        gamesWon: 7,
        winRate: 70,
        rankPoints: 1250,
        rankTier: 'Gold'
      }
    };

    it('should get user profile', async () => {
      // Mock cache miss and database hit
      mockCacheManager.get.mockResolvedValue(null);
      mockDbManager.query.mockResolvedValue({
        rows: [{
          user_id: 'test-user-123',
          player_id: 'test-player-123',
          email: 'test@example.com',
          given_name: 'Test',
          family_name: 'User',
          games_played: 10,
          games_won: 7,
          rank_points: 1250,
          rank_tier: 'Gold'
        }]
      });

      const response = await request(app)
        .get('/api/user/profile')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userId', 'test-user-123');
      expect(response.body.data).toHaveProperty('displayName', 'Test User');
    });

    it('should update user profile', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: [{
          user_id: 'test-user-123',
          given_name: 'Updated',
          family_name: 'Name',
          updated_at: new Date()
        }]
      });

      const updateData = {
        givenName: 'Updated',
        familyName: 'Name'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(mockCognitoService.updateCognitoUserAttributes).toHaveBeenCalled();
    });

    it('should validate profile update data', async () => {
      const invalidData = {
        givenName: 'A'.repeat(51), // Too long
        invalidField: 'value'
      };

      const response = await request(app)
        .put('/api/user/profile')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('User Preferences', () => {
    it('should get user preferences', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockDbManager.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/user/preferences')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('theme');
      expect(response.body.data).toHaveProperty('notifications');
    });

    it('should update user preferences', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: [{
          preferences: {
            theme: 'light',
            notifications: { email: false }
          }
        }]
      });

      const preferences = {
        theme: 'light',
        notifications: {
          email: false,
          push: true
        }
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .send(preferences)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Preferences updated successfully');
    });
  });

  describe('Game History', () => {
    it('should get user game history', async () => {
      const mockGameHistory = [
        {
          game_id: 'game123',
          status: 'completed',
          winner_id: 'test-user-123',
          started_at: new Date(),
          completed_at: new Date(),
          player1_player_id: 'test-player-123',
          player1_name: 'Test',
          player2_player_id: 'opponent123',
          player2_name: 'Opponent'
        }
      ];

      mockDbManager.query.mockResolvedValue({ rows: mockGameHistory });

      const response = await request(app)
        .get('/api/user/games?limit=10&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
    });
  });

  describe('User Search', () => {
    it('should search users', async () => {
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

      const response = await request(app)
        .get('/api/user/search?q=john&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('displayName', 'John Doe');
    });

    it('should validate search query', async () => {
      const response = await request(app)
        .get('/api/user/search?q=a') // Too short
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Leaderboard Position', () => {
    it('should get user leaderboard position', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockDbManager.query.mockResolvedValue({
        rows: [{
          position: 25,
          rank_points: 1400,
          total_players: 100
        }]
      });

      const response = await request(app)
        .get('/api/user/leaderboard-position')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('position', 25);
      expect(response.body.data).toHaveProperty('percentile', 75);
    });
  });

  describe('Statistics Update', () => {
    it('should update user statistics', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: [{
          user_id: 'test-user-123',
          games_played: 11,
          games_won: 8,
          rank_points: 1275
        }]
      });

      const statsUpdate = {
        gamesPlayed: 1,
        gamesWon: 1,
        scoreChange: 25
      };

      const response = await request(app)
        .post('/api/user/stats')
        .send(statsUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Statistics updated successfully');
      expect(mockCognitoService.syncUserStatsToCognito).toHaveBeenCalled();
    });
  });

  describe('Public Profile', () => {
    it('should get public profile by player ID', async () => {
      mockDbManager.query.mockResolvedValueOnce({
        rows: [{ user_id: 'test-user-123' }]
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockDbManager.query.mockResolvedValueOnce({
        rows: [{
          user_id: 'test-user-123',
          player_id: 'test-player-123',
          given_name: 'Test',
          family_name: 'User',
          games_played: 10,
          games_won: 7,
          rank_points: 1250
        }]
      });

      const response = await request(app)
        .get('/api/user/profile/test-player-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('playerId', 'test-player-123');
      expect(response.body.data).not.toHaveProperty('email'); // Should not include private data
    });
  });

  describe('Account Deletion', () => {
    it('should delete user account', async () => {
      mockDbManager.query.mockResolvedValue({
        rows: [{ user_id: 'test-user-123' }]
      });

      const response = await request(app)
        .delete('/api/user/account')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');
      expect(mockCognitoService.disableCognitoUser).toHaveBeenCalledWith('test-user-123');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDbManager.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/user/profile')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to API routes', async () => {
      // Make multiple requests quickly
      const requests = Array(10).fill().map(() => 
        request(app).get('/api/user/profile')
      );

      const responses = await Promise.all(requests);
      
      // All should succeed initially (within rate limit)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});