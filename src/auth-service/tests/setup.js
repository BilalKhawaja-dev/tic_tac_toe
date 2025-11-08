// Jest Setup File for Authentication Service
// Global test setup and configuration

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console output during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Create a mock user profile
  createMockUser: (overrides = {}) => {
    return {
      userId: 'test-user-123',
      playerId: 'test-player-123',
      email: 'test@example.com',
      givenName: 'Test',
      familyName: 'User',
      displayName: 'Test User',
      pictureUrl: 'https://example.com/avatar.jpg',
      authProvider: 'Cognito',
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      stats: {
        gamesPlayed: 10,
        gamesWon: 7,
        gamesLost: 2,
        gamesDrawn: 1,
        totalScore: 150,
        rankPoints: 1250,
        rankTier: 'Gold',
        currentStreak: 3,
        bestStreak: 5,
        winRate: 70
      },
      ...overrides
    };
  },

  // Create mock JWT token payload
  createMockJWTPayload: (overrides = {}) => {
    return {
      sub: 'test-user-123',
      email: 'test@example.com',
      player_id: 'test-player-123',
      given_name: 'Test',
      family_name: 'User',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides
    };
  },

  // Create mock preferences
  createMockPreferences: (overrides = {}) => {
    return {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        gameInvites: true,
        achievements: true
      },
      privacy: {
        showOnlineStatus: true,
        showGameHistory: true,
        allowFriendRequests: true
      },
      gameplay: {
        autoAcceptRematches: false,
        showMoveHints: true,
        soundEffects: true
      },
      ...overrides
    };
  },

  // Create mock game history entry
  createMockGameHistory: (overrides = {}) => {
    return {
      gameId: 'game-123',
      status: 'completed',
      result: 'win',
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(),
      opponent: {
        playerId: 'opponent-123',
        name: 'Opponent User'
      },
      gameData: {
        board: ['X', 'O', 'X', 'O', 'X', 'O', null, null, null],
        moves: 6
      },
      ...overrides
    };
  },

  // Wait for a specified time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate random user ID
  generateUserId: () => {
    return `test-user-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate random player ID
  generatePlayerId: () => {
    return `test-player-${Math.random().toString(36).substr(2, 9)}`;
  }
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.AWS_REGION = 'us-east-1';

// Mock timers for consistent testing
jest.useFakeTimers();

// Set up global mocks
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Reset fake timers
  jest.clearAllTimers();
});

afterEach(() => {
  // Clean up any remaining timers
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.useFakeTimers();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for integration tests
jest.setTimeout(30000);