// End-to-End Tests for Complete Authentication Flow
const request = require('supertest');
const AuthenticationServer = require('../../src/index');

// Mock external dependencies
jest.mock('../../src/database/DatabaseManager');
jest.mock('../../src/cache/CacheManager');
jest.mock('../../src/services/CognitoService');
jest.mock('../../src/services/JWTService');

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
  generateOAuthUrl: jest.fn(),
  generateLogoutUrl: jest.fn(),
  getCognitoUser: jest.fn(),
  updateCognitoUserAttributes: jest.fn()
};

const mockJWTService = {
  verifyToken: jest.fn(),
  extractUserInfo: jest.fn(),
  extractBearerToken: jest.fn(),
  isTokenExpired: jest.fn(),
  getTokenExpiration: jest.fn(),
  decodeToken: jest.fn(),
  createInternalToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  hasPermission: jest.fn(),
  hasRole: jest.fn()
};

describe('Authentication Flow E2E Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Mock the constructors
    require('../../src/database/DatabaseManager').mockImplementation(() => mockDbManager);
    require('../../src/cache/CacheManager').mockImplementation(() => mockCacheManager);
    require('../../src/services/CognitoService').mockImplementation(() => mockCognitoService);
    require('../../src/services/JWTService').mockImplementation(() => mockJWTService);

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

  describe('OAuth Flow', () => {
    it('should generate OAuth URL for Google', async () => {
      mockCognitoService.generateOAuthUrl.mockReturnValue(
        'https://test-domain.auth.us-east-1.amazoncognito.com/oauth2/authorize?response_type=code&client_id=test&redirect_uri=callback&scope=openid&identity_provider=Google'
      );

      const response = await request(app)
        .get('/api/auth/oauth/url/google?state=test-state')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toContain('identity_provider=Google');
      expect(response.body.data.provider).toBe('google');
      expect(mockCognitoService.generateOAuthUrl).toHaveBeenCalledWith('google', 'test-state');
    });

    it('should generate OAuth URL for Facebook', async () => {
      mockCognitoService.generateOAuthUrl.mockReturnValue(
        'https://test-domain.auth.us-east-1.amazoncognito.com/oauth2/authorize?response_type=code&client_id=test&redirect_uri=callback&scope=openid&identity_provider=Facebook'
      );

      const response = await request(app)
        .get('/api/auth/oauth/url/facebook')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.provider).toBe('facebook');
    });

    it('should reject invalid OAuth provider', async () => {
      const response = await request(app)
        .get('/api/auth/oauth/url/invalid-provider')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should generate logout URL', async () => {
      mockCognitoService.generateLogoutUrl.mockReturnValue(
        'https://test-domain.auth.us-east-1.amazoncognito.com/logout?client_id=test&logout_uri=callback'
      );

      const response = await request(app)
        .get('/api/auth/oauth/logout?redirect_uri=https://example.com/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logoutUrl).toContain('logout');
    });
  });

  describe('Token Validation Flow', () => {
    it('should validate valid token', async () => {
      const mockPayload = {
        sub: 'user123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const mockUser = {
        userId: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        playerId: 'player123',
        role: 'player',
        permissions: ['play_game'],
        accountStatus: 'active'
      };

      mockJWTService.verifyToken.mockResolvedValue(mockPayload);
      mockJWTService.extractUserInfo.mockReturnValue(mockUser);
      mockJWTService.isTokenExpired.mockReturnValue(false);
      mockJWTService.getTokenExpiration.mockReturnValue(new Date(Date.now() + 3600000));

      const response = await request(app)
        .post('/api/auth/validate')
        .send({ token: 'valid.jwt.token' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.expired).toBe(false);
      expect(response.body.data.user.userId).toBe('user123');
    });

    it('should handle expired token validation', async () => {
      mockJWTService.verifyToken.mockRejectedValue(new Error('Token expired'));

      const response = await request(app)
        .post('/api/auth/validate')
        .send({ token: 'expired.jwt.token' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.expired).toBe(true);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({}) // Missing token
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('User Info Flow', () => {
    const mockUser = {
      userId: 'user123',
      email: 'test@example.com',
      emailVerified: true,
      displayName: 'Test User',
      givenName: 'Test',
      familyName: 'User',
      picture: 'https://example.com/avatar.jpg',
      playerId: 'player123',
      gamesPlayed: 10,
      gamesWon: 7,
      winRate: 70,
      role: 'player',
      permissions: ['play_game', 'view_leaderboard'],
      authProvider: 'Google',
      accountStatus: 'active',
      tokenVersion: '1.0',
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    };

    beforeEach(() => {
      mockJWTService.extractBearerToken.mockReturnValue('valid.jwt.token');
      mockJWTService.verifyToken.mockResolvedValue({ sub: 'user123' });
      mockJWTService.extractUserInfo.mockReturnValue(mockUser);
    });

    it('should get current user info', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid.jwt.token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('user123');
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.displayName).toBe('Test User');
      expect(response.body.data.role).toBe('player');
    });

    it('should get token introspection', async () => {
      const mockDecodedToken = {
        header: { alg: 'RS256', kid: 'test-key-id' },
        payload: {
          sub: 'user123',
          aud: 'test-client-id',
          iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
          token_use: 'access',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        }
      };

      mockJWTService.decodeToken.mockReturnValue(mockDecodedToken);

      const response = await request(app)
        .get('/api/auth/introspect')
        .set('Authorization', 'Bearer valid.jwt.token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.header).toEqual(mockDecodedToken.header);
      expect(response.body.data.payload).toEqual(mockDecodedToken.payload);
      expect(response.body.data.user).toEqual(mockUser);
      expect(response.body.data.tokenInfo.algorithm).toBe('RS256');
    });

    it('should require authentication for protected endpoints', async () => {
      mockJWTService.extractBearerToken.mockReturnValue(null);

      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Internal Token Flow', () => {
    beforeEach(() => {
      const adminUser = {
        userId: 'admin123',
        role: 'admin',
        permissions: ['admin']
      };

      mockJWTService.extractBearerToken.mockReturnValue('admin.jwt.token');
      mockJWTService.verifyToken.mockResolvedValue({ sub: 'admin123' });
      mockJWTService.extractUserInfo.mockReturnValue(adminUser);
    });

    it('should create internal token for admin user', async () => {
      mockJWTService.createInternalToken.mockReturnValue('internal.service.token');

      const response = await request(app)
        .post('/api/auth/internal/token')
        .set('Authorization', 'Bearer admin.jwt.token')
        .send({
          service: 'game-engine',
          permissions: ['read', 'write'],
          expiresIn: '2h'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('internal.service.token');
      expect(mockJWTService.createInternalToken).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'game-engine',
          permissions: ['read', 'write']
        }),
        expect.objectContaining({
          expiresIn: '2h'
        })
      );
    });

    it('should reject internal token creation for non-admin', async () => {
      const regularUser = {
        userId: 'user123',
        role: 'player',
        permissions: ['play_game']
      };

      mockJWTService.extractUserInfo.mockReturnValue(regularUser);

      const response = await request(app)
        .post('/api/auth/internal/token')
        .set('Authorization', 'Bearer user.jwt.token')
        .send({ service: 'game-engine' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Refresh Token Flow', () => {
    it('should handle refresh token request', async () => {
      const mockRefreshPayload = {
        sub: 'user123',
        type: 'refresh'
      };

      mockJWTService.verifyRefreshToken.mockReturnValue(mockRefreshPayload);
      mockCognitoService.getCognitoUser.mockResolvedValue({
        username: 'user123',
        userStatus: 'CONFIRMED'
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid.refresh.token' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('user123');
      expect(response.body.data.refreshRequired).toBe(true);
    });

    it('should reject invalid refresh token', async () => {
      mockJWTService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid refresh token');
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.refresh.token' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Configuration and Health', () => {
    it('should get authentication configuration', async () => {
      const response = await request(app)
        .get('/api/auth/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.providers).toHaveProperty('cognito', true);
      expect(response.body.data.features).toHaveProperty('emailVerification', true);
      expect(response.body.data.tokenInfo).toHaveProperty('algorithm', 'RS256');
    });

    it('should get health status', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.service).toBe('Authentication Service');
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('Logout Flow', () => {
    it('should handle logout for authenticated user', async () => {
      const mockUser = { userId: 'user123', email: 'test@example.com' };

      mockJWTService.extractBearerToken.mockReturnValue('valid.token');
      mockJWTService.verifyToken.mockResolvedValue({ sub: 'user123' });
      mockJWTService.extractUserInfo.mockReturnValue(mockUser);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid.token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
      expect(response.body.data.loggedOut).toBe(true);
    });

    it('should handle logout for unauthenticated user', async () => {
      mockJWTService.extractBearerToken.mockReturnValue(null);

      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockJWTService.verifyToken.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .post('/api/auth/validate')
        .send({ token: 'any.token' })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });
});