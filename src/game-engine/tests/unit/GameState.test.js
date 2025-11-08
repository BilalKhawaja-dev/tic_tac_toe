// Unit Tests for GameState
const GameState = require('../../src/game/GameState');

describe('GameState', () => {
  const testData = {
    gameId: 'test-game-123',
    player1Id: 'player1',
    player2Id: 'player2',
    status: 'active',
    board: ['X', 'O', null, 'X', 'O', null, null, null, null],
    currentPlayer: 'X',
    winner: null,
    moves: [
      { playerId: 'player1', position: 0, symbol: 'X', timestamp: 1000, moveNumber: 1 },
      { playerId: 'player2', position: 1, symbol: 'O', timestamp: 2000, moveNumber: 2 },
      { playerId: 'player1', position: 3, symbol: 'X', timestamp: 3000, moveNumber: 3 },
      { playerId: 'player2', position: 4, symbol: 'O', timestamp: 4000, moveNumber: 4 }
    ],
    createdAt: 1000,
    lastMoveAt: 4000,
    completedAt: null,
    spectators: ['spectator1'],
    gameOptions: { allowSpectators: true, timeLimit: 30000 }
  };

  describe('constructor', () => {
    it('should create GameState with provided data', () => {
      const gameState = new GameState(testData);

      expect(gameState.gameId).toBe(testData.gameId);
      expect(gameState.player1Id).toBe(testData.player1Id);
      expect(gameState.player2Id).toBe(testData.player2Id);
      expect(gameState.status).toBe(testData.status);
      expect(gameState.board).toEqual(testData.board);
      expect(gameState.currentPlayer).toBe(testData.currentPlayer);
      expect(gameState.moves).toEqual(testData.moves);
      expect(gameState.spectators).toEqual(testData.spectators);
    });

    it('should create GameState with default values', () => {
      const gameState = new GameState({ gameId: 'test' });

      expect(gameState.gameId).toBe('test');
      expect(gameState.player2Id).toBeNull();
      expect(gameState.status).toBe('waiting');
      expect(gameState.board).toEqual(Array(9).fill(null));
      expect(gameState.currentPlayer).toBe('X');
      expect(gameState.winner).toBeNull();
      expect(gameState.moves).toEqual([]);
      expect(gameState.spectators).toEqual([]);
      expect(gameState.gameOptions).toEqual({});
    });
  });

  describe('getCurrentPlayerSymbol', () => {
    it('should return current player symbol', () => {
      const gameState = new GameState({ currentPlayer: 'X' });
      expect(gameState.getCurrentPlayerSymbol()).toBe('X');

      gameState.currentPlayer = 'O';
      expect(gameState.getCurrentPlayerSymbol()).toBe('O');
    });
  });

  describe('getCurrentPlayerId', () => {
    it('should return correct player ID for current turn', () => {
      const gameState = new GameState({
        player1Id: 'player1',
        player2Id: 'player2',
        currentPlayer: 'X'
      });

      expect(gameState.getCurrentPlayerId()).toBe('player1');

      gameState.currentPlayer = 'O';
      expect(gameState.getCurrentPlayerId()).toBe('player2');
    });
  });

  describe('getOpponentId', () => {
    it('should return opponent ID for given player', () => {
      const gameState = new GameState({
        player1Id: 'player1',
        player2Id: 'player2'
      });

      expect(gameState.getOpponentId('player1')).toBe('player2');
      expect(gameState.getOpponentId('player2')).toBe('player1');
      expect(gameState.getOpponentId('unknown')).toBeNull();
    });
  });

  describe('getPlayerSymbol', () => {
    it('should return correct symbol for each player', () => {
      const gameState = new GameState({
        player1Id: 'player1',
        player2Id: 'player2'
      });

      expect(gameState.getPlayerSymbol('player1')).toBe('X');
      expect(gameState.getPlayerSymbol('player2')).toBe('O');
      expect(gameState.getPlayerSymbol('unknown')).toBeNull();
    });
  });

  describe('isPlayerInGame', () => {
    it('should correctly identify players in game', () => {
      const gameState = new GameState({
        player1Id: 'player1',
        player2Id: 'player2'
      });

      expect(gameState.isPlayerInGame('player1')).toBe(true);
      expect(gameState.isPlayerInGame('player2')).toBe(true);
      expect(gameState.isPlayerInGame('unknown')).toBe(false);
    });
  });

  describe('isSpectator', () => {
    it('should correctly identify spectators', () => {
      const gameState = new GameState({
        spectators: ['spectator1', 'spectator2']
      });

      expect(gameState.isSpectator('spectator1')).toBe(true);
      expect(gameState.isSpectator('spectator2')).toBe(true);
      expect(gameState.isSpectator('unknown')).toBe(false);
    });
  });

  describe('getAllParticipants', () => {
    it('should return all players and spectators', () => {
      const gameState = new GameState({
        player1Id: 'player1',
        player2Id: 'player2',
        spectators: ['spectator1', 'spectator2']
      });

      const participants = gameState.getAllParticipants();
      expect(participants).toContain('player1');
      expect(participants).toContain('player2');
      expect(participants).toContain('spectator1');
      expect(participants).toContain('spectator2');
      expect(participants).toHaveLength(4);
    });

    it('should not include duplicate participants', () => {
      const gameState = new GameState({
        player1Id: 'player1',
        player2Id: 'player2',
        spectators: ['player1', 'spectator1'] // player1 is both player and spectator
      });

      const participants = gameState.getAllParticipants();
      expect(participants.filter(p => p === 'player1')).toHaveLength(1);
      expect(participants).toHaveLength(3);
    });
  });

  describe('getDuration', () => {
    it('should calculate game duration for completed game', () => {
      const gameState = new GameState({
        createdAt: 1000,
        completedAt: 6000
      });

      expect(gameState.getDuration()).toBe(5000);
    });

    it('should calculate duration from current time for active game', () => {
      const now = Date.now();
      const gameState = new GameState({
        createdAt: now - 5000,
        completedAt: null
      });

      const duration = gameState.getDuration();
      expect(duration).toBeGreaterThanOrEqual(5000);
      expect(duration).toBeLessThan(6000);
    });
  });

  describe('getTimeSinceLastMove', () => {
    it('should calculate time since last move', () => {
      const now = Date.now();
      const gameState = new GameState({
        lastMoveAt: now - 3000
      });

      const timeSince = gameState.getTimeSinceLastMove();
      expect(timeSince).toBeGreaterThanOrEqual(3000);
      expect(timeSince).toBeLessThan(4000);
    });
  });

  describe('status checks', () => {
    it('should correctly identify active games', () => {
      const gameState = new GameState({ status: 'active' });
      expect(gameState.isActive()).toBe(true);
      expect(gameState.isCompleted()).toBe(false);
      expect(gameState.isWaiting()).toBe(false);
    });

    it('should correctly identify completed games', () => {
      const gameState = new GameState({ status: 'completed' });
      expect(gameState.isActive()).toBe(false);
      expect(gameState.isCompleted()).toBe(true);
      expect(gameState.isWaiting()).toBe(false);
    });

    it('should correctly identify abandoned games as completed', () => {
      const gameState = new GameState({ status: 'abandoned' });
      expect(gameState.isCompleted()).toBe(true);
    });

    it('should correctly identify waiting games', () => {
      const gameState = new GameState({ status: 'waiting' });
      expect(gameState.isActive()).toBe(false);
      expect(gameState.isCompleted()).toBe(false);
      expect(gameState.isWaiting()).toBe(true);
    });
  });

  describe('toClientJSON', () => {
    let gameState;

    beforeEach(() => {
      gameState = new GameState(testData);
    });

    it('should return safe client data without player perspective', () => {
      const clientData = gameState.toClientJSON();

      expect(clientData).toHaveProperty('gameId');
      expect(clientData).toHaveProperty('status');
      expect(clientData).toHaveProperty('board');
      expect(clientData).toHaveProperty('currentPlayer');
      expect(clientData).toHaveProperty('moveCount');
      expect(clientData).toHaveProperty('spectatorCount');
      expect(clientData).not.toHaveProperty('player1Id');
      expect(clientData).not.toHaveProperty('player2Id');
      expect(clientData).not.toHaveProperty('moves');
      expect(clientData).not.toHaveProperty('spectators');
    });

    it('should include player-specific data for players', () => {
      const clientData = gameState.toClientJSON('player1');

      expect(clientData.isPlayer).toBe(true);
      expect(clientData.playerSymbol).toBe('X');
      expect(clientData.opponentId).toBe('player2');
      expect(clientData.isCurrentTurn).toBe(true);
      expect(clientData.player1Id).toBe('player1');
      expect(clientData.player2Id).toBe('player2');
    });

    it('should include spectator-specific data for spectators', () => {
      const clientData = gameState.toClientJSON('spectator1');

      expect(clientData.isSpectator).toBe(true);
      expect(clientData.player1Id).toBe('player1');
      expect(clientData.player2Id).toBe('player2');
    });

    it('should include player IDs for completed games', () => {
      gameState.status = 'completed';
      const clientData = gameState.toClientJSON('unknown');

      expect(clientData.player1Id).toBe('player1');
      expect(clientData.player2Id).toBe('player2');
    });
  });

  describe('getLastMoveInfo', () => {
    it('should return last move information', () => {
      const gameState = new GameState(testData);
      const lastMove = gameState.getLastMoveInfo();

      expect(lastMove.playerId).toBe('player2');
      expect(lastMove.position).toBe(4);
      expect(lastMove.symbol).toBe('O');
      expect(lastMove.moveNumber).toBe(4);
    });

    it('should return null for games with no moves', () => {
      const gameState = new GameState({ moves: [] });
      expect(gameState.getLastMoveInfo()).toBeNull();
    });
  });

  describe('getPlayerMoves', () => {
    it('should return moves for specific player', () => {
      const gameState = new GameState(testData);
      const player1Moves = gameState.getPlayerMoves('player1');

      expect(player1Moves).toHaveLength(2);
      expect(player1Moves[0].position).toBe(0);
      expect(player1Moves[1].position).toBe(3);
    });
  });

  describe('clone', () => {
    it('should create independent copy of game state', () => {
      const gameState = new GameState(testData);
      const cloned = gameState.clone();

      expect(cloned).not.toBe(gameState);
      expect(cloned.gameId).toBe(gameState.gameId);
      expect(cloned.board).toEqual(gameState.board);
      expect(cloned.board).not.toBe(gameState.board); // Different array reference

      // Modify clone and ensure original is unchanged
      cloned.board[0] = 'O';
      expect(gameState.board[0]).toBe('X');
    });
  });

  describe('validate', () => {
    it('should validate correct game state', () => {
      const gameState = new GameState({
        gameId: 'test',
        player1Id: 'player1',
        player2Id: 'player2',
        status: 'active',
        currentPlayer: 'X',
        board: Array(9).fill(null)
      });

      const validation = gameState.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing game ID', () => {
      const gameState = new GameState({ player1Id: 'player1' });
      gameState.gameId = null;

      const validation = gameState.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Game ID is required');
    });

    it('should detect missing player1', () => {
      const gameState = new GameState({ gameId: 'test' });
      gameState.player1Id = null;

      const validation = gameState.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Player 1 ID is required');
    });

    it('should detect invalid board', () => {
      const gameState = new GameState({
        gameId: 'test',
        player1Id: 'player1',
        board: [1, 2, 3] // Wrong length
      });

      const validation = gameState.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Board must be an array of 9 elements');
    });

    it('should detect invalid current player', () => {
      const gameState = new GameState({
        gameId: 'test',
        player1Id: 'player1',
        currentPlayer: 'Z'
      });

      const validation = gameState.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Current player must be X or O');
    });

    it('should detect active game without player2', () => {
      const gameState = new GameState({
        gameId: 'test',
        player1Id: 'player1',
        status: 'active'
      });

      const validation = gameState.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Active game must have two players');
    });

    it('should detect invalid winner', () => {
      const gameState = new GameState({
        gameId: 'test',
        player1Id: 'player1',
        player2Id: 'player2',
        winner: 'unknown'
      });

      const validation = gameState.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Winner must be a player in the game or draw');
    });
  });

  describe('serialization', () => {
    it('should serialize to and from JSON', () => {
      const gameState = new GameState(testData);
      const json = gameState.toJSON();
      const restored = GameState.fromJSON(json);

      expect(restored.gameId).toBe(gameState.gameId);
      expect(restored.board).toEqual(gameState.board);
      expect(restored.moves).toEqual(gameState.moves);
      expect(restored.spectators).toEqual(gameState.spectators);
    });

    it('should convert to database format', () => {
      const gameState = new GameState(testData);
      const dbFormat = gameState.toDatabaseFormat();

      expect(dbFormat.game_id).toBe(testData.gameId);
      expect(dbFormat.player1_id).toBe(testData.player1Id);
      expect(dbFormat.player2_id).toBe(testData.player2Id);
      expect(dbFormat.status).toBe(testData.status);
      expect(dbFormat.winner_id).toBe(testData.winner);
      expect(dbFormat.game_data.board).toEqual(testData.board);
      expect(dbFormat.game_data.moves).toEqual(testData.moves);
      expect(dbFormat.started_at).toBeInstanceOf(Date);
      expect(dbFormat.last_move_at).toBeInstanceOf(Date);
    });

    it('should create from database row', () => {
      const dbRow = {
        game_id: 'test-game',
        player1_id: 'player1',
        player2_id: 'player2',
        status: 'active',
        winner_id: null,
        game_data: {
          board: ['X', null, null, null, null, null, null, null, null],
          currentPlayer: 'O',
          moves: [{ playerId: 'player1', position: 0, symbol: 'X' }],
          spectators: [],
          gameOptions: {}
        },
        started_at: '2023-01-01T00:00:00Z',
        last_move_at: '2023-01-01T00:01:00Z',
        completed_at: null
      };

      const gameState = GameState.fromDatabaseRow(dbRow);

      expect(gameState.gameId).toBe('test-game');
      expect(gameState.player1Id).toBe('player1');
      expect(gameState.board[0]).toBe('X');
      expect(gameState.currentPlayer).toBe('O');
      expect(gameState.moves).toHaveLength(1);
    });
  });
});