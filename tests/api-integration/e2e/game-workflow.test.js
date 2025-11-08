// End-to-End Game Workflow Tests
// Tests complete user journey from authentication to game completion

const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('Complete Game Workflow E2E Tests', () => {
  let authToken;
  let userId;
  let gameId;

  // Helper function to create auth token
  const createAuthToken = (user) => {
    return jwt.sign(
      {
        sub: user.userId,
        userId: user.userId,
        email: user.email,
        role: 'user'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  // Helper function to make authenticated requests
  const authenticatedRequest = (method, url, data = null) => {
    const config = {
      method,
      url: `${API_BASE_URL}${url}`,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    if (data) {
      config.data = data;
    }
    return axios(config);
  };

  beforeAll(() => {
    // Create test user and auth token
    const testUser = global.testUtils.generateTestUser();
    userId = testUser.userId;
    authToken = createAuthToken(testUser);
  });

  describe('User Authentication Flow', () => {
    test('should get OAuth URL', async () => {
      const response = await axios.get(`${API_BASE_URL}/auth/oauth/url`, {
        params: {
          provider: 'google',
          redirect_uri: 'https://example.com/callback'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.url).toContain('google');
      expect(response.data.data.state).toBeDefined();
    });

    test('should get current user profile', async () => {
      const response = await authenticatedRequest('GET', '/users/me');

      expect(response.status).toBe(200);
      expect(response.data.userId).toBeDefined();
      expect(response.data.email).toBeDefined();
    });

    test('should get user statistics', async () => {
      const response = await authenticatedRequest('GET', '/users/me/stats');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('gamesPlayed');
      expect(response.data).toHaveProperty('gamesWon');
      expect(response.data).toHaveProperty('winPercentage');
    });
  });

  describe('Game Creation and Play Flow', () => {
    test('should create a new game', async () => {
      const response = await authenticatedRequest('POST', '/game/games', {
        opponentId: 'opponent-123'
      });

      expect(response.status).toBe(201);
      expect(response.data.gameId).toBeDefined();
      expect(response.data.players).toHaveLength(2);
      expect(response.data.status).toBe('active');
      expect(response.data.board).toEqual([
        [null, null, null],
        [null, null, null],
        [null, null, null]
      ]);

      gameId = response.data.gameId;
    });

    test('should get game state', async () => {
      const response = await authenticatedRequest('GET', `/game/games/${gameId}`);

      expect(response.status).toBe(200);
      expect(response.data.gameId).toBe(gameId);
      expect(response.data.status).toBe('active');
    });

    test('should make a valid move', async () => {
      const response = await authenticatedRequest('POST', `/game/games/${gameId}/moves`, {
        row: 0,
        col: 0
      });

      expect(response.status).toBe(200);
      expect(response.data.board[0][0]).not.toBeNull();
      expect(response.data.currentPlayer).toBeDefined();
    });

    test('should reject invalid move (occupied position)', async () => {
      try {
        await authenticatedRequest('POST', `/game/games/${gameId}/moves`, {
          row: 0,
          col: 0
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(409);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error).toContain('INVALID_MOVE');
      }
    });

    test('should reject invalid move (out of bounds)', async () => {
      try {
        await authenticatedRequest('POST', `/game/games/${gameId}/moves`, {
          row: 5,
          col: 5
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
      }
    });

    test('should forfeit game', async () => {
      const response = await authenticatedRequest('DELETE', `/game/games/${gameId}`);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('forfeited');
      expect(response.data.winner).toBeDefined();
    });
  });

  describe('Leaderboard Flow', () => {
    test('should get global leaderboard', async () => {
      const response = await axios.get(`${API_BASE_URL}/leaderboard/global`, {
        params: {
          limit: 10,
          offset: 0
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.rankings).toBeInstanceOf(Array);
      expect(response.data.data.total).toBeGreaterThanOrEqual(0);
    });

    test('should get regional leaderboard', async () => {
      const response = await axios.get(`${API_BASE_URL}/leaderboard/regional/europe`, {
        params: {
          limit: 10
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.rankings).toBeInstanceOf(Array);
    });

    test('should get user ranking', async () => {
      const response = await authenticatedRequest('GET', `/leaderboard/user/${userId}`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.userId).toBe(userId);
      expect(response.data.data).toHaveProperty('globalRank');
    });
  });

  describe('Support Ticket Flow', () => {
    let ticketId;

    test('should create support ticket', async () => {
      const response = await authenticatedRequest('POST', '/support/tickets', {
        subject: 'Test Issue',
        description: 'This is a test support ticket for integration testing',
        category: 'technical',
        priority: 'medium'
      });

      expect(response.status).toBe(201);
      expect(response.data.ticketId).toBeDefined();
      expect(response.data.status).toBe('open');
      expect(response.data.subject).toBe('Test Issue');

      ticketId = response.data.ticketId;
    });

    test('should get ticket details', async () => {
      const response = await authenticatedRequest('GET', `/support/tickets/${ticketId}`);

      expect(response.status).toBe(200);
      expect(response.data.ticketId).toBe(ticketId);
      expect(response.data.userId).toBe(userId);
    });

    test('should list user tickets', async () => {
      const response = await authenticatedRequest('GET', '/support/tickets');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });

    test('should search FAQ', async () => {
      const response = await axios.get(`${API_BASE_URL}/support/faq/search`, {
        params: {
          q: 'how to play'
        }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should return 401 for missing authentication', async () => {
      try {
        await axios.get(`${API_BASE_URL}/game/games`);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error).toBe('UNAUTHORIZED');
      }
    });

    test('should return 404 for non-existent resource', async () => {
      try {
        await authenticatedRequest('GET', '/game/games/non-existent-id');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error).toBe('NOT_FOUND');
      }
    });

    test('should return 400 for invalid request body', async () => {
      try {
        await authenticatedRequest('POST', '/game/games', {
          invalidField: 'invalid'
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
      }
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const requests = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 150; i++) {
        requests.push(
          axios.get(`${API_BASE_URL}/leaderboard/global`).catch(err => err.response)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r && r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].data.error).toBe('Too Many Requests');
    }, 60000);
  });
});
