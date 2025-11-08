// Unit Tests for GameValidator
const GameValidator = require('../../src/game/GameValidator');
const GameState = require('../../src/game/GameState');

describe('GameValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new GameValidator();
  });

  describe('validateMove', () => {
    let gameState;

    beforeEach(() => {
      gameState = new GameState({
        gameId: 'test-game',
        player1Id: 'player1',
        player2Id: 'player2',
        status: 'active',
        board: Array(9).fill(null),
        currentPlayer: 'X'
      });
    });

    it('should validate correct move', () => {
      const result = validator.validateMove(gameState, 'player1', 0);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject move from non-current player', () => {
      const result = validator.validateMove(gameState, 'player2', 0);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not your turn');
    });

    it('should reject move from player not in game', () => {
      const result = validator.validateMove(gameState, 'unknown', 0);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in this game');
    });

    it('should reject move on occupied position', () => {
      gameState.board[0] = 'X';
      const result = validator.validateMove(gameState, 'player1', 0);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('already occupied');
    });

    it('should reject move with invalid position', () => {
      const result = validator.validateMove(gameState, 'player1', -1);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid position');
    });

    it('should reject move with position out of bounds', () => {
      const result = validator.validateMove(gameState, 'player1', 9);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid position');
    });

    it('should reject move in non-active game', () => {
      gameState.status = 'waiting';
      const result = validator.validateMove(gameState, 'player1', 0);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Game is not active');
    });

    it('should reject move in completed game', () => {
      gameState.status = 'completed';
      const result = validator.validateMove(gameState, 'player1', 0);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Game is not active');
    });
  });

  describe('checkGameEnd', () => {
    it('should detect horizontal win - top row', () => {
      const board = ['X', 'X', 'X', null, null, null, null, null, null];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBe('X');
      expect(result.winningLine).toEqual([0, 1, 2]);
    });

    it('should detect horizontal win - middle row', () => {
      const board = [null, null, null, 'O', 'O', 'O', null, null, null];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBe('O');
      expect(result.winningLine).toEqual([3, 4, 5]);
    });

    it('should detect horizontal win - bottom row', () => {
      const board = [null, null, null, null, null, null, 'X', 'X', 'X'];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBe('X');
      expect(result.winningLine).toEqual([6, 7, 8]);
    });

    it('should detect vertical win - left column', () => {
      const board = ['O', null, null, 'O', null, null, 'O', null, null];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBe('O');
      expect(result.winningLine).toEqual([0, 3, 6]);
    });

    it('should detect vertical win - middle column', () => {
      const board = [null, 'X', null, null, 'X', null, null, 'X', null];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBe('X');
      expect(result.winningLine).toEqual([1, 4, 7]);
    });

    it('should detect vertical win - right column', () => {
      const board = [null, null, 'O', null, null, 'O', null, null, 'O'];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBe('O');
      expect(result.winningLine).toEqual([2, 5, 8]);
    });

    it('should detect diagonal win - top-left to bottom-right', () => {
      const board = ['X', null, null, null, 'X', null, null, null, 'X'];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBe('X');
      expect(result.winningLine).toEqual([0, 4, 8]);
    });

    it('should detect diagonal win - top-right to bottom-left', () => {
      const board = [null, null, 'O', null, 'O', null, 'O', null, null];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBe('O');
      expect(result.winningLine).toEqual([2, 4, 6]);
    });

    it('should detect draw when board is full with no winner', () => {
      const board = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O'];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBeNull();
      expect(result.isDraw).toBe(true);
    });

    it('should return false for ongoing game', () => {
      const board = ['X', 'O', null, 'O', 'X', null, null, null, null];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(false);
      expect(result.winner).toBeNull();
    });

    it('should prioritize win over draw', () => {
      const board = ['X', 'X', 'X', 'O', 'O', 'X', 'O', 'X', 'O'];
      const result = validator.checkGameEnd(board);
      
      expect(result.isGameOver).toBe(true);
      expect(result.winner).toBe('X');
      expect(result.isDraw).toBe(false);
    });
  });

  describe('isValidPosition', () => {
    it('should validate correct positions', () => {
      for (let i = 0; i < 9; i++) {
        expect(validator.isValidPosition(i)).toBe(true);
      }
    });

    it('should reject negative positions', () => {
      expect(validator.isValidPosition(-1)).toBe(false);
      expect(validator.isValidPosition(-10)).toBe(false);
    });

    it('should reject positions >= 9', () => {
      expect(validator.isValidPosition(9)).toBe(false);
      expect(validator.isValidPosition(10)).toBe(false);
    });

    it('should reject non-integer positions', () => {
      expect(validator.isValidPosition(1.5)).toBe(false);
      expect(validator.isValidPosition('1')).toBe(false);
      expect(validator.isValidPosition(null)).toBe(false);
      expect(validator.isValidPosition(undefined)).toBe(false);
    });
  });

  describe('isBoardFull', () => {
    it('should return true for full board', () => {
      const board = ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'];
      expect(validator.isBoardFull(board)).toBe(true);
    });

    it('should return false for empty board', () => {
      const board = Array(9).fill(null);
      expect(validator.isBoardFull(board)).toBe(false);
    });

    it('should return false for partially filled board', () => {
      const board = ['X', 'O', null, 'O', 'X', null, null, null, null];
      expect(validator.isBoardFull(board)).toBe(false);
    });
  });

  describe('getAvailablePositions', () => {
    it('should return all positions for empty board', () => {
      const board = Array(9).fill(null);
      const available = validator.getAvailablePositions(board);
      
      expect(available).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('should return no positions for full board', () => {
      const board = ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'];
      const available = validator.getAvailablePositions(board);
      
      expect(available).toEqual([]);
    });

    it('should return correct available positions for partially filled board', () => {
      const board = ['X', null, 'O', null, 'X', null, null, 'O', null];
      const available = validator.getAvailablePositions(board);
      
      expect(available).toEqual([1, 3, 5, 6, 8]);
    });
  });

  describe('validateGameState', () => {
    it('should validate correct game state', () => {
      const gameState = new GameState({
        gameId: 'test',
        player1Id: 'player1',
        player2Id: 'player2',
        status: 'active',
        board: ['X', 'O', null, null, null, null, null, null, null],
        currentPlayer: 'X',
        moves: [
          { playerId: 'player1', position: 0, symbol: 'X' },
          { playerId: 'player2', position: 1, symbol: 'O' }
        ]
      });

      const result = validator.validateGameState(gameState);
      expect(result.valid).toBe(true);
    });

    it('should detect board-move mismatch', () => {
      const gameState = new GameState({
        gameId: 'test',
        player1Id: 'player1',
        player2Id: 'player2',
        status: 'active',
        board: ['X', 'O', null, null, null, null, null, null, null],
        currentPlayer: 'X',
        moves: [
          { playerId: 'player1', position: 0, symbol: 'X' }
          // Missing move for position 1
        ]
      });

      const result = validator.validateGameState(gameState);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Board state does not match move history');
    });

    it('should detect incorrect current player', () => {
      const gameState = new GameState({
        gameId: 'test',
        player1Id: 'player1',
        player2Id: 'player2',
        status: 'active',
        board: ['X', 'O', null, null, null, null, null, null, null],
        currentPlayer: 'O', // Should be X after 2 moves
        moves: [
          { playerId: 'player1', position: 0, symbol: 'X' },
          { playerId: 'player2', position: 1, symbol: 'O' }
        ]
      });

      const result = validator.validateGameState(gameState);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Current player does not match expected turn');
    });

    it('should detect game that should be completed', () => {
      const gameState = new GameState({
        gameId: 'test',
        player1Id: 'player1',
        player2Id: 'player2',
        status: 'active', // Should be completed
        board: ['X', 'X', 'X', 'O', 'O', null, null, null, null],
        currentPlayer: 'X',
        winner: null
      });

      const result = validator.validateGameState(gameState);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Game should be completed but status is active');
    });
  });

  describe('edge cases', () => {
    it('should handle null board gracefully', () => {
      expect(() => validator.checkGameEnd(null)).not.toThrow();
      expect(validator.checkGameEnd(null).isGameOver).toBe(false);
    });

    it('should handle invalid board length', () => {
      const shortBoard = ['X', 'O'];
      expect(() => validator.checkGameEnd(shortBoard)).not.toThrow();
      expect(validator.checkGameEnd(shortBoard).isGameOver).toBe(false);
    });

    it('should handle board with invalid values', () => {
      const invalidBoard = ['X', 'Y', 'Z', null, null, null, null, null, null];
      expect(() => validator.checkGameEnd(invalidBoard)).not.toThrow();
      expect(validator.checkGameEnd(invalidBoard).isGameOver).toBe(false);
    });
  });
});