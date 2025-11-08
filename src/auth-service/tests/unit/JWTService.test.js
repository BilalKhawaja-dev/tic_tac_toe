// Unit Tests for JWTService
const JWTService = require('../../src/services/JWTService');
const jwt = require('jsonwebtoken');
const { UnauthorizedError, ValidationError } = require('../../src/utils/errors');

// Mock jwks-client
jest.mock('jwks-rsa', () => {
  return jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn().mockResolvedValue({
      getPublicKey: () => 'mock-public-key'
    })
  }));
});

// Mock config
jest.mock('../../src/config', () => ({
  cognito: {
    jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test/.well-known/jwks.json',
    clientId: 'test-client-id',
    issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test'
  },
  jwt: {
    secret: 'test-secret',
    refreshSecret: 'test-refresh-secret'
  },
  auth: {
    validApiKeys: ['test-api-key-1', 'test-api-key-2']
  }
}));

describe('JWTService', () => {
  let jwtService;
  const mockToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5LWlkIn0.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjk5OTk5OTk5OTl9.mock-signature';

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService = new JWTService();
  });

  describe('verifyToken', () => {
    it('should verify valid token successfully', async () => {
      const mockPayload = {
        sub: 'test-user-123',
        email: 'test@example.com',
        iat: 1600000000,
        exp: 9999999999,
        token_use: 'access'
      };

      jest.spyOn(jwt, 'decode').mockReturnValue({
        header: { kid: 'test-key-id', alg: 'RS256' },
        payload: mockPayload
      });

      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

      const result = await jwtService.verifyToken(mockToken);

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith(
        mockToken,
        'mock-public-key',
        expect.objectContaining({
          algorithms: ['RS256'],
          audience: 'test-client-id'
        })
      );
    });

    it('should throw error for token without kid', async () => {
      jest.spyOn(jwt, 'decode').mockReturnValue({
        header: { alg: 'RS256' },
        payload: {}
      });

      await expect(jwtService.verifyToken(mockToken))
        .rejects.toThrow(ValidationError);
    });

    it('should handle expired token', async () => {
      jest.spyOn(jwt, 'decode').mockReturnValue({
        header: { kid: 'test-key-id', alg: 'RS256' }
      });

      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw expiredError;
      });

      await expect(jwtService.verifyToken(mockToken))
        .rejects.toThrow(UnauthorizedError);
    });

    it('should handle invalid token', async () => {
      jest.spyOn(jwt, 'decode').mockReturnValue({
        header: { kid: 'test-key-id', alg: 'RS256' }
      });

      const invalidError = new Error('Invalid token');
      invalidError.name = 'JsonWebTokenError';
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw invalidError;
      });

      await expect(jwtService.verifyToken(mockToken))
        .rejects.toThrow(UnauthorizedError);
    });
  });

  describe('validateTokenPayload', () => {
    it('should validate correct payload', () => {
      const validPayload = {
        sub: 'test-user-123',
        email: 'test@example.com',
        iat: 1600000000,
        exp: 9999999999
      };

      expect(() => jwtService.validateTokenPayload(validPayload)).not.toThrow();
    });

    it('should reject payload missing required claims', () => {
      const invalidPayload = {
        sub: 'test-user-123',
        // Missing email, iat, exp
      };

      expect(() => jwtService.validateTokenPayload(invalidPayload))
        .toThrow(ValidationError);
    });

    it('should reject invalid email format', () => {
      const invalidPayload = {
        sub: 'test-user-123',
        email: 'invalid-email',
        iat: 1600000000,
        exp: 9999999999
      };

      expect(() => jwtService.validateTokenPayload(invalidPayload))
        .toThrow(ValidationError);
    });

    it('should reject expired token', () => {
      const expiredPayload = {
        sub: 'test-user-123',
        email: 'test@example.com',
        iat: 1600000000,
        exp: 1600000001 // Expired
      };

      expect(() => jwtService.validateTokenPayload(expiredPayload))
        .toThrow(UnauthorizedError);
    });
  });

  describe('extractUserInfo', () => {
    it('should extract user information from token payload', () => {
      const payload = {
        sub: 'test-user-123',
        email: 'test@example.com',
        email_verified: 'true',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/avatar.jpg',
        'custom:player_id': 'player-123',
        'custom:games_played': '10',
        'custom:games_won': '7',
        role: 'player',
        permissions: ['play_game', 'view_leaderboard'],
        iat: 1600000000,
        exp: 1600003600
      };

      const userInfo = jwtService.extractUserInfo(payload);

      expect(userInfo).toEqual({
        userId: 'test-user-123',
        email: 'test@example.com',
        emailVerified: true,
        givenName: 'Test',
        familyName: 'User',
        displayName: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        playerId: 'player-123',
        gamesPlayed: 10,
        gamesWon: 7,
        winRate: 0,
        role: 'player',
        permissions: ['play_game', 'view_leaderboard'],
        authProvider: 'Cognito',
        accountStatus: 'active',
        tokenVersion: '1.0',
        issuedAt: 1600000000,
        expiresAt: 1600003600
      });
    });

    it('should handle missing optional fields', () => {
      const minimalPayload = {
        sub: 'test-user-123',
        email: 'test@example.com',
        iat: 1600000000,
        exp: 1600003600
      };

      const userInfo = jwtService.extractUserInfo(minimalPayload);

      expect(userInfo.displayName).toBe('test');
      expect(userInfo.playerId).toBe('');
      expect(userInfo.gamesPlayed).toBe(0);
      expect(userInfo.role).toBe('player');
    });
  });

  describe('createInternalToken', () => {
    it('should create internal token with default options', () => {
      const payload = { userId: 'test-user-123', service: 'game-engine' };
      
      jest.spyOn(jwt, 'sign').mockReturnValue('internal-token');

      const token = jwtService.createInternalToken(payload);

      expect(token).toBe('internal-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-123',
          service: 'game-engine',
          aud: 'internal',
          iss: 'auth-service'
        }),
        'test-secret',
        expect.objectContaining({
          expiresIn: '1h',
          algorithm: 'HS256'
        })
      );
    });

    it('should create internal token with custom options', () => {
      const payload = { userId: 'test-user-123' };
      const options = {
        expiresIn: '2h',
        audience: 'custom-service',
        issuer: 'custom-issuer'
      };

      jest.spyOn(jwt, 'sign').mockReturnValue('custom-internal-token');

      const token = jwtService.createInternalToken(payload, options);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          aud: 'custom-service',
          iss: 'custom-issuer'
        }),
        'test-secret',
        expect.objectContaining({
          expiresIn: '2h'
        })
      );
    });
  });

  describe('verifyInternalToken', () => {
    it('should verify valid internal token', () => {
      const mockPayload = { sub: 'test-user-123', aud: 'internal' };
      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

      const result = jwtService.verifyInternalToken('internal-token');

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith(
        'internal-token',
        'test-secret',
        { algorithms: ['HS256'] }
      );
    });

    it('should handle expired internal token', () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw expiredError;
      });

      expect(() => jwtService.verifyInternalToken('expired-token'))
        .toThrow(UnauthorizedError);
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API key', () => {
      expect(() => jwtService.validateApiKey('test-api-key-1')).not.toThrow();
    });

    it('should reject invalid API key', () => {
      expect(() => jwtService.validateApiKey('invalid-key'))
        .toThrow(UnauthorizedError);
    });

    it('should reject missing API key', () => {
      expect(() => jwtService.validateApiKey(null))
        .toThrow(UnauthorizedError);
    });
  });

  describe('createRefreshToken', () => {
    it('should create refresh token', () => {
      jest.spyOn(jwt, 'sign').mockReturnValue('refresh-token');

      const token = jwtService.createRefreshToken('test-user-123');

      expect(token).toBe('refresh-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'test-user-123',
          type: 'refresh'
        }),
        'test-refresh-secret',
        expect.objectContaining({
          expiresIn: '30d',
          algorithm: 'HS256'
        })
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const mockPayload = { sub: 'test-user-123', type: 'refresh' };
      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

      const result = jwtService.verifyRefreshToken('refresh-token');

      expect(result).toEqual(mockPayload);
    });

    it('should reject token with wrong type', () => {
      const mockPayload = { sub: 'test-user-123', type: 'access' };
      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

      expect(() => jwtService.verifyRefreshToken('wrong-type-token'))
        .toThrow(UnauthorizedError);
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
      const token = jwtService.extractBearerToken('Bearer test-token-123');
      expect(token).toBe('test-token-123');
    });

    it('should return null for invalid header format', () => {
      expect(jwtService.extractBearerToken('Invalid test-token-123')).toBeNull();
      expect(jwtService.extractBearerToken('Bearer')).toBeNull();
      expect(jwtService.extractBearerToken('')).toBeNull();
      expect(jwtService.extractBearerToken(null)).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return true for matching permission', () => {
      const permissions = ['read', 'write', 'delete'];
      expect(jwtService.hasPermission(permissions, 'read')).toBe(true);
    });

    it('should return true for admin permission', () => {
      const permissions = ['admin'];
      expect(jwtService.hasPermission(permissions, 'any-permission')).toBe(true);
    });

    it('should return true for wildcard permission', () => {
      const permissions = ['*'];
      expect(jwtService.hasPermission(permissions, 'any-permission')).toBe(true);
    });

    it('should return false for missing permission', () => {
      const permissions = ['read'];
      expect(jwtService.hasPermission(permissions, 'write')).toBe(false);
    });

    it('should handle invalid permissions array', () => {
      expect(jwtService.hasPermission(null, 'read')).toBe(false);
      expect(jwtService.hasPermission('not-array', 'read')).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      expect(jwtService.hasRole('moderator', ['admin', 'moderator'])).toBe(true);
    });

    it('should return true for admin role', () => {
      expect(jwtService.hasRole('admin', ['moderator'])).toBe(true);
    });

    it('should return false for non-matching role', () => {
      expect(jwtService.hasRole('user', ['admin', 'moderator'])).toBe(false);
    });

    it('should handle single role string', () => {
      expect(jwtService.hasRole('admin', 'admin')).toBe(true);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      jest.spyOn(jwt, 'decode').mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      });

      expect(jwtService.isTokenExpired('valid-token')).toBe(false);
    });

    it('should return true for expired token', () => {
      jest.spyOn(jwt, 'decode').mockReturnValue({
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      });

      expect(jwtService.isTokenExpired('expired-token')).toBe(true);
    });

    it('should return true for invalid token', () => {
      jest.spyOn(jwt, 'decode').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(jwtService.isTokenExpired('invalid-token')).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date for valid token', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      jest.spyOn(jwt, 'decode').mockReturnValue({ exp });

      const expiration = jwtService.getTokenExpiration('valid-token');
      expect(expiration).toEqual(new Date(exp * 1000));
    });

    it('should return null for token without exp claim', () => {
      jest.spyOn(jwt, 'decode').mockReturnValue({});

      const expiration = jwtService.getTokenExpiration('no-exp-token');
      expect(expiration).toBeNull();
    });

    it('should return null for invalid token', () => {
      jest.spyOn(jwt, 'decode').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const expiration = jwtService.getTokenExpiration('invalid-token');
      expect(expiration).toBeNull();
    });
  });
});