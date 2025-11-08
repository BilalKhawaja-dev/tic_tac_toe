// Jest Setup File
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
  // Create a mock game state
  createMockGameState: (overrides = {}) => {
    return {
      gameId: 'test-game-123',
      player1Id: 'player1',
      player2Id: 'player2',
      status: 'active',
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      moves: [],
      createdAt: Date.now(),
      lastMoveAt: Date.now(),
      completedAt: null,
      spectators: [],
      gameOptions: {
        allowSpectators: true,
        timeLimit: 30000
      },
      ...overrides
    };
  },

  // Create a mock player
  createMockPlayer: (id = 'test-player', overrides = {}) => {
    return {
      id,
      username: `user_${id}`,
      displayName: `User ${id}`,
      isOnline: true,
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDrawn: 0,
        winRate: 0
      },
      ...overrides
    };
  },

  // Wait for a specified time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Create a winning board state
  createWinningBoard: (winner = 'X') => {
    if (winner === 'X') {
      return ['X', 'X', 'X', 'O', 'O', null, null, null, null];
    } else {
      return ['O', 'O', 'O', 'X', 'X', null, null, null, null];
    }
  },

  // Create a draw board state
  createDrawBoard: () => {
    return ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O'];
  },

  // Generate random game ID
  generateGameId: () => {
    return `test-game-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate random player ID
  generatePlayerId: () => {
    return `test-player-${Math.random().toString(36).substr(2, 9)}`;
  }
};

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