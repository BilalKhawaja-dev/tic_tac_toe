// Global Test Setup
// Configures test environment and utilities

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock configuration
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.CACHE_ENABLED = 'true';
process.env.RATE_LIMIT_ENABLED = 'false'; // Disable for most tests

// Increase test timeout for integration tests
jest.setTimeout(10000);

// Suppress console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    user_id: 'test-user-id',
    username: 'testuser',
    display_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    region: 'EU',
    ...overrides
  }),

  createMockLeaderboardEntry: (rank, overrides = {}) => ({
    user_id: `user-${rank}`,
    username: `player${rank}`,
    display_name: `Player ${rank}`,
    global_rank: rank,
    games_played: 100,
    games_won: 75,
    games_lost: 20,
    games_drawn: 5,
    win_percentage: 75.0,
    rating: 1500,
    current_streak: 5,
    best_streak: 10,
    ...overrides
  }),

  createMockLeaderboard: (count = 10) => {
    return Array.from({ length: count }, (_, i) => 
      global.testUtils.createMockLeaderboardEntry(i + 1)
    );
  }
};
