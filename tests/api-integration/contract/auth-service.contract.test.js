// Contract Tests for Auth Service
// Tests the contract between API Gateway and Auth Service

const { Pact } = require('@pact-foundation/pact');
const axios = require('axios');
const path = require('path');

describe('Auth Service Contract Tests', () => {
  const provider = new Pact({
    consumer: 'API-Gateway',
    provider: 'Auth-Service',
    port: 8080,
    log: path.resolve(process.cwd(), 'logs', 'pact.log'),
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: 'warn'
  });

  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());

  describe('OAuth URL Generation', () => {
    test('should return OAuth URL for valid provider', async () => {
      await provider.addInteraction({
        state: 'OAuth provider is configured',
        uponReceiving: 'a request for OAuth URL',
        withRequest: {
          method: 'GET',
          path: '/auth/oauth/url',
          query: {
            provider: 'google',
            redirect_uri: 'https://example.com/callback'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            success: true,
            data: {
              url: 'https://accounts.google.com/o/oauth2/v2/auth',
              state: 'random-state-string'
            }
          }
        }
      });

      const response = await axios.get('http://localhost:8080/auth/oauth/url', {
        params: {
          provider: 'google',
          redirect_uri: 'https://example.com/callback'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.url).toBeDefined();
      expect(response.data.data.state).toBeDefined();
    });

    test('should return error for invalid provider', async () => {
      await provider.addInteraction({
        state: 'OAuth provider is not configured',
        uponReceiving: 'a request for OAuth URL with invalid provider',
        withRequest: {
          method: 'GET',
          path: '/auth/oauth/url',
          query: {
            provider: 'invalid',
            redirect_uri: 'https://example.com/callback'
          }
        },
        willRespondWith: {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            success: false,
            error: 'BAD_REQUEST',
            message: 'Invalid OAuth provider'
          }
        }
      });

      try {
        await axios.get('http://localhost:8080/auth/oauth/url', {
          params: {
            provider: 'invalid',
            redirect_uri: 'https://example.com/callback'
          }
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
      }
    });
  });

  describe('User Profile', () => {
    test('should return user profile for authenticated user', async () => {
      await provider.addInteraction({
        state: 'user is authenticated',
        uponReceiving: 'a request for user profile',
        withRequest: {
          method: 'GET',
          path: '/users/me',
          headers: {
            Authorization: 'Bearer valid-token'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            userId: 'user-123',
            email: 'test@example.com',
            username: 'testuser',
            displayName: 'Test User',
            socialProvider: 'google',
            createdAt: '2025-01-01T00:00:00Z'
          }
        }
      });

      const response = await axios.get('http://localhost:8080/users/me', {
        headers: {
          Authorization: 'Bearer valid-token'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.userId).toBeDefined();
      expect(response.data.email).toBeDefined();
      expect(response.data.username).toBeDefined();
    });

    test('should return 401 for unauthenticated request', async () => {
      await provider.addInteraction({
        state: 'user is not authenticated',
        uponReceiving: 'a request for user profile without token',
        withRequest: {
          method: 'GET',
          path: '/users/me'
        },
        willRespondWith: {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        }
      });

      try {
        await axios.get('http://localhost:8080/users/me');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.success).toBe(false);
      }
    });
  });

  describe('User Statistics', () => {
    test('should return user statistics', async () => {
      await provider.addInteraction({
        state: 'user has game statistics',
        uponReceiving: 'a request for user statistics',
        withRequest: {
          method: 'GET',
          path: '/users/me/stats',
          headers: {
            Authorization: 'Bearer valid-token'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            gamesPlayed: 10,
            gamesWon: 6,
            gamesLost: 3,
            gamesDrawn: 1,
            currentStreak: 2,
            bestStreak: 4,
            winPercentage: 60.0
          }
        }
      });

      const response = await axios.get('http://localhost:8080/users/me/stats', {
        headers: {
          Authorization: 'Bearer valid-token'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.gamesPlayed).toBeDefined();
      expect(response.data.gamesWon).toBeDefined();
      expect(response.data.winPercentage).toBeDefined();
    });
  });
});
