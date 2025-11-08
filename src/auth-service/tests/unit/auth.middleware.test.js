// Unit Tests for Authentication Middleware
const {
  authenticateToken,
  optionalAuth,
  requirePermission,
  requireRole,
  authenticateApiKey,
  rateLimitByUser
} = require('../../src/middleware/auth');

const { UnauthorizedError, ForbiddenError } = require('../../src/utils/errors');

// Mock services
const mockJWTService = {
  extractBearerToken: jest.fn(),
  verifyToken: jest.fn(),
  extractUserInfo: jest.fn(),
  validateApiKey: jest.fn(),
  hasPermission: jest.fn(),
  hasRole: jest.fn()
};

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      headers: {},
      app: {
        locals: {
          services: {
            jwt: mockJWTService
          }
        }
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', async () => {
      const mockToken = 'valid-token';
      const mockPayload = { sub: 'user123', email: 'test@example.com' };
      const mockUserInfo = { userId: 'user123', email: 'test@example.com' };

      req.headers.authorization = 'Bearer valid-token';
      mockJWTService.extractBearerToken.mockReturnValue(mockToken);
      mockJWTService.verifyToken.mockResolvedValue(mockPayload);
      mockJWTService.extractUserInfo.mockReturnValue(mockUserInfo);

      await authenticateToken(req, res, next);

      expect(req.user).toEqual(mockUserInfo);
      expect(req.token).toBe(mockToken);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without token', async () => {
      mockJWTService.extractBearerToken.mockReturnValue(null);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'Access token is required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      mockJWTService.extractBearerToken.mockReturnValue('invalid-token');
      mockJWTService.verifyToken.mockRejectedValue(new UnauthorizedError('Invalid token'));

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate when valid token provided', async () => {
      const mockToken = 'valid-token';
      const mockPayload = { sub: 'user123' };
      const mockUserInfo = { userId: 'user123' };

      req.headers.authorization = 'Bearer valid-token';
      mockJWTService.extractBearerToken.mockReturnValue(mockToken);
      mockJWTService.verifyToken.mockResolvedValue(mockPayload);
      mockJWTService.extractUserInfo.mockReturnValue(mockUserInfo);

      await optionalAuth(req, res, next);

      expect(req.user).toEqual(mockUserInfo);
      expect(req.authenticated).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('should continue without authentication when no token provided', async () => {
      mockJWTService.extractBearerToken.mockReturnValue(null);

      await optionalAuth(req, res, next);

      expect(req.authenticated).toBe(false);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should continue without authentication when token is invalid', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      mockJWTService.extractBearerToken.mockReturnValue('invalid-token');
      mockJWTService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      await optionalAuth(req, res, next);

      expect(req.authenticated).toBe(false);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    it('should allow request with required permission', () => {
      req.user = { permissions: ['read', 'write'] };
      mockJWTService.hasPermission.mockReturnValue(true);

      const middleware = requirePermission('read');
      middleware(req, res, next);

      expect(mockJWTService.hasPermission).toHaveBeenCalledWith(['read', 'write'], 'read');
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without required permission', () => {
      req.user = { permissions: ['read'] };
      mockJWTService.hasPermission.mockReturnValue(false);

      const middleware = requirePermission('write');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message: "Permission 'write' is required"
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated request', () => {
      // req.user is undefined

      const middleware = requirePermission('read');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow request with required role', () => {
      req.user = { role: 'admin' };
      mockJWTService.hasRole.mockReturnValue(true);

      const middleware = requireRole(['admin', 'moderator']);
      middleware(req, res, next);

      expect(mockJWTService.hasRole).toHaveBeenCalledWith('admin', ['admin', 'moderator']);
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without required role', () => {
      req.user = { role: 'user' };
      mockJWTService.hasRole.mockReturnValue(false);

      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message: "Role 'admin' is required"
      });
    });
  });

  describe('authenticateApiKey', () => {
    it('should authenticate valid API key from header', () => {
      req.headers['x-api-key'] = 'valid-api-key';
      mockJWTService.validateApiKey.mockReturnValue(true);

      authenticateApiKey(req, res, next);

      expect(mockJWTService.validateApiKey).toHaveBeenCalledWith('valid-api-key');
      expect(req.serviceAuth).toBe(true);
      expect(req.apiKey).toBe('valid-api-key');
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate valid API key from query', () => {
      req.query = { api_key: 'valid-api-key' };
      mockJWTService.validateApiKey.mockReturnValue(true);

      authenticateApiKey(req, res, next);

      expect(req.serviceAuth).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without API key', () => {
      mockJWTService.validateApiKey.mockImplementation(() => {
        throw new UnauthorizedError('API key is required');
      });

      authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    });
  });

  describe('rateLimitByUser', () => {
    it('should allow requests within rate limit', () => {
      req.user = { userId: 'user123' };
      
      const middleware = rateLimitByUser(5, 60000); // 5 requests per minute
      
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject requests exceeding rate limit', () => {
      req.user = { userId: 'user123' };
      
      const middleware = rateLimitByUser(2, 60000); // 2 requests per minute
      
      // Make 3 requests (should reject the 3rd)
      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: expect.any(Number)
      });
    });

    it('should use IP address when user not authenticated', () => {
      req.ip = '192.168.1.1';
      
      const middleware = rateLimitByUser(5, 60000);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});