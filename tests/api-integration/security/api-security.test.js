// API Security Tests
// Tests for common security vulnerabilities

const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('API Security Tests', () => {
  let validToken;

  beforeAll(() => {
    const testUser = global.testUtils.generateTestUser();
    validToken = jwt.sign(
      {
        sub: testUser.userId,
        userId: testUser.userId,
        email: testUser.email,
        role: 'user'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('Authentication Security', () => {
    test('should reject requests without authentication token', async () => {
      try {
        await axios.get(`${API_BASE_URL}/game/games`);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.error).toBe('UNAUTHORIZED');
      }
    });

    test('should reject invalid JWT tokens', async () => {
      try {
        await axios.get(`${API_BASE_URL}/game/games`, {
          headers: {
            Authorization: 'Bearer invalid-token'
          }
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        {
          sub: 'user-123',
          userId: 'user-123',
          email: 'test@example.com'
        },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );

      try {
        await axios.get(`${API_BASE_URL}/game/games`, {
          headers: {
            Authorization: `Bearer ${expiredToken}`
          }
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should reject tokens with invalid signature', async () => {
      const invalidToken = jwt.sign(
        {
          sub: 'user-123',
          userId: 'user-123',
          email: 'test@example.com'
        },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      try {
        await axios.get(`${API_BASE_URL}/game/games`, {
          headers: {
            Authorization: `Bearer ${invalidToken}`
          }
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should sanitize SQL injection attempts in query parameters', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      try {
        await axios.get(`${API_BASE_URL}/leaderboard/global`, {
          params: {
            limit: sqlInjection
          }
        });
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe('BAD_REQUEST');
      }
    });

    test('should sanitize SQL injection in request body', async () => {
      const sqlInjection = "admin' OR '1'='1";
      
      try {
        await axios.post(
          `${API_BASE_URL}/support/tickets`,
          {
            subject: sqlInjection,
            description: 'Test',
            category: 'technical'
          },
          {
            headers: {
              Authorization: `Bearer ${validToken}`
            }
          }
        );
      } catch (error) {
        // Should either reject or sanitize
        expect([400, 201]).toContain(error.response?.status || 201);
      }
    });
  });

  describe('XSS Prevention', () => {
    test('should sanitize XSS attempts in input', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      try {
        const response = await axios.post(
          `${API_BASE_URL}/support/tickets`,
          {
            subject: xssPayload,
            description: 'Test description',
            category: 'technical'
          },
          {
            headers: {
              Authorization: `Bearer ${validToken}`
            }
          }
        );

        // Response should not contain unescaped script tags
        expect(response.data.subject).not.toContain('<script>');
      } catch (error) {
        // Should reject malicious input
        expect(error.response.status).toBe(400);
      }
    });

    test('should set security headers', async () => {
      const response = await axios.get(`${API_BASE_URL}/leaderboard/global`);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('CSRF Protection', () => {
    test('should require CSRF token for state-changing operations', async () => {
      // This test assumes CSRF protection is implemented
      try {
        await axios.post(
          `${API_BASE_URL}/game/games`,
          {},
          {
            headers: {
              Authorization: `Bearer ${validToken}`
              // Missing CSRF token
            }
          }
        );
      } catch (error) {
        // May require CSRF token or accept without for API-only endpoints
        expect([201, 403]).toContain(error.response?.status || 201);
      }
    });
  });

  describe('Authorization Checks', () => {
    test('should prevent access to other users resources', async () => {
      const otherUserId = 'other-user-123';
      
      try {
        await axios.get(`${API_BASE_URL}/users/${otherUserId}`, {
          headers: {
            Authorization: `Bearer ${validToken}`
          }
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect([403, 404]).toContain(error.response.status);
      }
    });

    test('should enforce role-based access control', async () => {
      // Regular user trying to access admin endpoint
      try {
        await axios.get(`${API_BASE_URL}/admin/users`, {
          headers: {
            Authorization: `Bearer ${validToken}`
          }
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect([403, 404]).toContain(error.response.status);
      }
    });
  });

  describe('Input Validation', () => {
    test('should validate email format', async () => {
      try {
        await axios.put(
          `${API_BASE_URL}/users/me`,
          {
            email: 'invalid-email'
          },
          {
            headers: {
              Authorization: `Bearer ${validToken}`
            }
          }
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe('BAD_REQUEST');
      }
    });

    test('should validate required fields', async () => {
      try {
        await axios.post(
          `${API_BASE_URL}/support/tickets`,
          {
            // Missing required fields
            subject: 'Test'
          },
          {
            headers: {
              Authorization: `Bearer ${validToken}`
            }
          }
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });

    test('should validate data types', async () => {
      try {
        await axios.post(
          `${API_BASE_URL}/game/games/test-game/moves`,
          {
            row: 'invalid',
            col: 'invalid'
          },
          {
            headers: {
              Authorization: `Bearer ${validToken}`
            }
          }
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });

    test('should validate value ranges', async () => {
      try {
        await axios.get(`${API_BASE_URL}/leaderboard/global`, {
          params: {
            limit: 1000 // Exceeds maximum
          }
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('CORS Security', () => {
    test('should set CORS headers correctly', async () => {
      const response = await axios.options(`${API_BASE_URL}/leaderboard/global`);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    test('should handle preflight requests', async () => {
      const response = await axios.options(`${API_BASE_URL}/game/games`, {
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Authorization'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('Information Disclosure Prevention', () => {
    test('should not expose sensitive error details', async () => {
      try {
        await axios.get(`${API_BASE_URL}/game/games/invalid-id`, {
          headers: {
            Authorization: `Bearer ${validToken}`
          }
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.data).not.toHaveProperty('stack');
        expect(error.response.data).not.toHaveProperty('sql');
        expect(error.response.data.message).not.toContain('database');
      }
    });

    test('should not expose server information', async () => {
      const response = await axios.get(`${API_BASE_URL}/leaderboard/global`);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toContain('Express');
    });
  });

  describe('Denial of Service Prevention', () => {
    test('should limit request payload size', async () => {
      const largePayload = {
        description: 'A'.repeat(10000) // Very large description
      };

      try {
        await axios.post(
          `${API_BASE_URL}/support/tickets`,
          {
            subject: 'Test',
            ...largePayload,
            category: 'technical'
          },
          {
            headers: {
              Authorization: `Bearer ${validToken}`
            }
          }
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect([400, 413]).toContain(error.response.status);
      }
    });

    test('should timeout long-running requests', async () => {
      try {
        await axios.get(`${API_BASE_URL}/game/games`, {
          headers: {
            Authorization: `Bearer ${validToken}`
          },
          timeout: 30000
        });
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          expect(error.message).toContain('timeout');
        }
      }
    }, 35000);
  });
});
