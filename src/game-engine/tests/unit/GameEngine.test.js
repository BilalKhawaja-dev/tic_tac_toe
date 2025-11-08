// Unit Tests for GameEngine
const GameEngine = require('../../src/game/GameEngine');
const GameState = require('../../src/game/GameState');
const GameValidator = require('../../src/game/GameValidator');

// Mock dependencies
const mockDbManager = {
  saveGameState: jest.fn().mockResolvedValue(true),
  saveMove: jest.fn().mockResolvedValue(true),
  getGameState: jest.fn().mockResolvedValue(null),
  getPlayerGames: jest.fn().mockResolvedValue([]),
  updatePlayerStats: jest.fn().mockResolvedValue(true)
};

const mockCacheManager = {
  setGameState: jest.fn().mockResolvedValue(true),
  getGameState: jest.fn().mockResolvedValue(null)
};

// Mock config
jest.mock('../../src/config', () => ({
  game: {
    moveTimeout: 30000,
    gameTimeout: 300000,
    maxSpectators: 10
  }
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('GameEngine', () => {
  let gameEngine;
  const testPlayerId1 = 'player1';
  const testPlayerId2 = 'player2';

  beforeEach(() => {
    jest.clearAllMocks();
    gameEngine = new GameEngine(mockDbManager, mockCacheManager);
  });

  afterEach(() => {
    // Clear any active timeouts
    gameEngine.activeGames.clear();
    gameEngine.gameTimeouts.forEach(timeout => clearTimeout(timeout));
    gameEngine.gameTimeouts.clear();
  });

  describe('createGame', () => {
    it('should create a new game successfully', async () => {
      const gameState = await gameEngine.createGame(testPlayerId1);

      expect(gameState).toBeInstanceOf(GameState);
      expect(gameState.player1Id).toBe(testPlayerId1);
      expect(gameState.player2Id).toBeNull();
      expect(gameState.status).toBe('waiting');
      expect(gameState.board).toEqual(Array(9).fill(null));
      expect(gameState.currentPlayer).toBe('X');
      expect(gameEngine.stats.gamesCreated).toBe(1);
      expect(mockDbManager.saveGameState).toHaveBeenCalledWith(gameState);
      expect(mockCacheManager.setGameState).toHaveBeenCalled();
    });

    it('should create game with custom options', async () => {
      const gameOptions = {
        timeLimit: 60000,
        allowSpectators: false
      };

      const gameState = await gameEngine.createGame(testPlayerId1, gameOptions);

      expect(gameState.gameOptions.timeLimit).toBe(60000);
      expect(gameState.gameOptions.allowSpectators).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockDbManager.saveGameState.mockRejectedValueOnce(new Error('Database error'));

      await expect(gameEngine.createGame(testPlayerId1)).rejects.toThrow('Failed to create game');
    });
  });

  describe('joinGame', () => {
    let gameState;

    beforeEach(async () => {
      gameState = await gameEngine.createGame(testPlayerId1);
    });

    it('should allow second player to join waiting game', async () => {
      const updatedGameState = await gameEngine.joinGame(gameState.gameId, testPlayerId2);

      expect(updatedGameState.player2Id).toBe(testPlayerId2);
      expect(updatedGameState.status).toBe('active');
      expect(mockDbManager.saveGameState).toHaveBeenCalledTimes(2); // Create + Join
    });

    it('should not allow player to join their own game', async () => {
      await expect(gameEngine.joinGame(gameState.gameId, testPlayerId1))
        .rejects.toThrow('Cannot join your own game');
    });

    it('should not allow joining non-existent game', async () => {
      await expect(gameEngine.joinGame('non-existent-id', testPlayerId2))
        .rejects.toThrow('Game not found');
    });

    it('should not allow joining full game', async () => {
      await gameEngine.joinGame(gameState.gameId, testPlayerId2);
      
      await expect(gameEngine.joinGame(gameState.gameId, 'player3'))
        .rejects.toThrow('Game is already full');
    });

    it('should not allow joining completed game', async () => {
      gameState.status = 'completed';
      gameEngine.activeGames.set(gameState.gameId, gameState);

      await expect(gameEngine.joinGame(gameState.gameId, testPlayerId2))
        .rejects.toThrow('Game is not available for joining');
    });
  });

  describe('makeMove', () => {
    let gameState;

    beforeEach(async () => {
      gameState = await gameEngine.createGame(testPlayerId1);
      await gameEngine.joinGame(gameState.gameId, testPlayerId2);
      gameState = gameEngine.activeGames.get(gameState.gameId);
    });

    it('should allow valid move by current player', async () => {
      const result = await gameEngine.makeMove(gameState.gameId, testPlayerId1, 0);

      expect(result.gameState.board[0]).toBe('X');
      expect(result.gameState.currentPlayer).toBe('O');
      expect(result.move.playerId).toBe(testPlayerId1);
      expect(result.move.position).toBe(0);
      expect(result.move.symbol).toBe('X');
      expect(gameEngine.stats.totalMoves).toBe(1);
    });

    it('should not allow move by non-current player', async () => {
      await expect(gameEngine.makeMove(gameState.gameId, testPlayerId2, 0))
        .rejects.toThrow();
    });

    it('should not allow move on occupied position', async () => {
      await gameEngine.makeMove(gameState.gameId, testPlayerId1, 0);
      
      await expect(gameEngine.makeMove(gameState.gameId, testPlayerId2, 0))
        .rejects.toThrow();
    });

    it('should detect win condition', async () => {
      // Set up winning scenario for X
      gameState.board = ['X', 'X', null, 'O', 'O', null, null, null, null];
      gameState.moves = [
        { playerId: testPlayerId1, position: 0, symbol: 'X', timestamp: Date.now(), moveNumber: 1 },
        { playerId: testPlayerId2, position: 3, symbol: 'O', timestamp: Date.now(), moveNumber: 2 },
        { playerId: testPlayerId1, position: 1, symbol: 'X', timestamp: Date.now(), moveNumber: 3 },
        { playerId: testPlayerId2, position: 4, symbol: 'O', timestamp: Date.now(), moveNumber: 4 }
      ];
      gameState.currentPlayer = 'X';

      const result = await gameEngine.makeMove(gameState.gameId, testPlayerId1, 2);

      expect(result.gameState.status).toBe('completed');
      expect(result.gameState.winner).toBe(testPlayerId1);
      expect(result.gameResult.isGameOver).toBe(true);
      expect(gameEngine.stats.gamesCompleted).toBe(1);
    });

    it('should detect draw condition', async () => {
      // Set up draw scenario
      gameState.board = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', null];
      gameState.moves = Array(8).fill(null).map((_, i) => ({
        playerId: i % 2 === 0 ? testPlayerId1 : testPlayerId2,
        position: i,
        symbol: i % 2 === 0 ? 'X' : 'O',
        timestamp: Date.now(),
        moveNumber: i + 1
      }));
      gameState.currentPlayer = 'X';

      const result = await gameEngine.makeMove(gameState.gameId, testPlayerId1, 8);

      expect(result.gameState.status).toBe('completed');
      expect(result.gameState.winner).toBeNull();
      expect(result.gameResult.isGameOver).toBe(true);
    });
  });

  describe('addSpectator', () => {
    let gameState;

    beforeEach(async () => {
      gameState = await gameEngine.createGame(testPlayerId1, { allowSpectators: true });
    });

    it('should add spectator to game', async () => {
      const spectatorId = 'spectator1';
      const updatedGameState = await gameEngine.addSpectator(gameState.gameId, spectatorId);

      expect(updatedGameState.spectators).toContain(spectatorId);
    });

    it('should not add spectator if not allowed', async () => {
      gameState.gameOptions.allowSpectators = false;
      gameEngine.activeGames.set(gameState.gameId, gameState);

      await expect(gameEngine.addSpectator(gameState.gameId, 'spectator1'))
        .rejects.toThrow('Spectators not allowed for this game');
    });

    it('should not exceed maximum spectators', async () => {
      // Add maximum spectators
      for (let i = 0; i < 10; i++) {
        await gameEngine.addSpectator(gameState.gameId, `spectator${i}`);
      }

      await expect(gameEngine.addSpectator(gameState.gameId, 'spectator10'))
        .rejects.toThrow('Maximum spectators reached');
    });

    it('should not add duplicate spectator', async () => {
      const spectatorId = 'spectator1';
      await gameEngine.addSpectator(gameState.gameId, spectatorId);
      const updatedGameState = await gameEngine.addSpectator(gameState.gameId, spectatorId);

      expect(updatedGameState.spectators.filter(id => id === spectatorId)).toHaveLength(1);
    });
  });

  describe('abandonGame', () => {
    let gameState;

    beforeEach(async () => {
      gameState = await gameEngine.createGame(testPlayerId1);
      await gameEngine.joinGame(gameState.gameId, testPlayerId2);
      gameState = gameEngine.activeGames.get(gameState.gameId);
    });

    it('should abandon active game and declare opponent winner', async () => {
      const result = await gameEngine.abandonGame(gameState.gameId, testPlayerId1);

      expect(result.status).toBe('abandoned');
      expect(result.winner).toBe(testPlayerId2);
      expect(result.completedAt).toBeTruthy();
    });

    it('should handle abandoning completed game gracefully', async () => {
      gameState.status = 'completed';
      gameEngine.activeGames.set(gameState.gameId, gameState);

      const result = await gameEngine.abandonGame(gameState.gameId, testPlayerId1);
      expect(result).toBeUndefined();
    });
  });

  describe('getGameState', () => {
    it('should retrieve game from memory first', async () => {
      const gameState = await gameEngine.createGame(testPlayerId1);
      const retrieved = await gameEngine.getGameState(gameState.gameId);

      expect(retrieved).toBe(gameState);
      expect(mockCacheManager.getGameState).not.toHaveBeenCalled();
      expect(mockDbManager.getGameState).not.toHaveBeenCalled();
    });

    it('should fallback to cache if not in memory', async () => {
      const gameId = 'test-game-id';
      const cachedData = { gameId, status: 'waiting' };
      mockCacheManager.getGameState.mockResolvedValueOnce(cachedData);

      const retrieved = await gameEngine.getGameState(gameId);

      expect(retrieved).toBeInstanceOf(GameState);
      expect(mockCacheManager.getGameState).toHaveBeenCalledWith(gameId);
      expect(gameEngine.activeGames.has(gameId)).toBe(true);
    });

    it('should fallback to database if not in cache', async () => {
      const gameId = 'test-game-id';
      const dbData = { game_id: gameId, status: 'waiting' };
      mockDbManager.getGameState.mockResolvedValueOnce(dbData);

      const retrieved = await gameEngine.getGameState(gameId);

      expect(retrieved).toBeInstanceOf(GameState);
      expect(mockDbManager.getGameState).toHaveBeenCalledWith(gameId);
      expect(mockCacheManager.setGameState).toHaveBeenCalled();
    });

    it('should return null if game not found anywhere', async () => {
      const retrieved = await gameEngine.getGameState('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return current statistics', () => {
      const stats = gameEngine.getStats();

      expect(stats).toHaveProperty('gamesCreated');
      expect(stats).toHaveProperty('gamesCompleted');
      expect(stats).toHaveProperty('totalMoves');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('activeGames');
      expect(stats).toHaveProperty('memoryUsage');
    });
  });

  describe('timeout handling', () => {
    it('should set timeout when creating game', async () => {
      const gameState = await gameEngine.createGame(testPlayerId1);
      
      expect(gameEngine.gameTimeouts.has(gameState.gameId)).toBe(true);
    });

    it('should clear timeout when game completes', async () => {
      const gameState = await gameEngine.createGame(testPlayerId1);
      await gameEngine.joinGame(gameState.gameId, testPlayerId2);
      
      // Complete the game
      const updatedGameState = gameEngine.activeGames.get(gameState.gameId);
      updatedGameState.board = ['X', 'X', 'X', null, null, null, null, null, null];
      await gameEngine.makeMove(gameState.gameId, testPlayerId1, 0);

      expect(gameEngine.gameTimeouts.has(gameState.gameId)).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up completed games from memory', (done) => {
      // Create a completed game
      const gameState = new GameState({
        gameId: 'test-game',
        status: 'completed',
        completedAt: Date.now() - 10 * 60 * 1000 // 10 minutes ago
      });
      
      gameEngine.activeGames.set('test-game', gameState);
      
      // Trigger cleanup manually
      setTimeout(() => {
        expect(gameEngine.activeGames.has('test-game')).toBe(false);
        done();
      }, 100);
    });
  });
});