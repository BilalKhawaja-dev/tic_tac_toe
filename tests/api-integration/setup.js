// API Integration Test Setup

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  generateTestUser: () => ({
    userId: `test-user-${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    username: `testuser${Date.now()}`,
    displayName: 'Test User'
  }),
  
  generateTestGame: () => ({
    gameId: `test-game-${Date.now()}`,
    players: [`player1-${Date.now()}`, `player2-${Date.now()}`],
    board: [[null, null, null], [null, null, null], [null, null, null]],
    currentPlayer: `player1-${Date.now()}`,
    status: 'active'
  }),
  
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};
