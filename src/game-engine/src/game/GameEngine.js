// Core Game Engine - Tic-Tac-Toe Logic and State Management
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');
const GameValidator = require('./GameValidator');
const GameState = require('./GameState');

class GameEngine {
  constructor(dbManager, cacheManager) {
    this.dbManager = dbManager;
    this.cacheManager = cacheManager;
    this.validator = new GameValidator();
    
    // In-memory game state for active games
    this.activeGames = new Map();
    this.playerConnections = new Map(); // playerId -> connectionId
    this.gameTimeouts = new Map(); // gameId -> timeoutId
    
    // Game statistics
    this.stats = {
      gamesCreated: 0,
      gamesCompleted: 0,
      totalMoves: 0,
      activeConnections: 0
    };

    this.setupCleanupInterval();
  }

  // Create a new game
  async createGame(playerId, gameOptions = {}) {
    try {
      const gameId = uuidv4();
      const timestamp = Date.now();

      const gameState = new GameState({
        gameId,
        player1Id: playerId,
        player2Id: null,
        status: 'waiting',
        board: Array(9).fill(null),
        currentPlayer: 'X',
        winner: null,
        moves: [],
        createdAt: timestamp,
        lastMoveAt: timestamp,
        spectators: [],
        gameOptions: {
          timeLimit: gameOptions.timeLimit || config.game.moveTimeout,
          allowSpectators: gameOptions.allowSpectators !== false,
          ...gameOptions
        }
      });

      // Store in memory for quick access
      this.activeGames.set(gameId, gameState);

      // Persist to database
      await this.saveGameState(gameState);

      // Cache game state
      await this.cacheManager.setGameState(gameId, gameState.toJSON());

      // Set game timeout
      this.setGameTimeout(gameId);

      this.stats.gamesCreated++;
      logger.info(`Game created: ${gameId} by player: ${playerId}`);

      return gameState;
    } catch (error) {
      logger.error('Error creating game:', error);
      throw new Error('Failed to create game');
    }
  }

  // Join an existing game
  async joinGame(gameId, playerId) {
    try {
      const gameState = await this.getGameState(gameId);
      
      if (!gameState) {
        throw new Error('Game not found');
      }

      if (gameState.status !== 'waiting') {
        throw new Error('Game is not available for joining');
      }

      if (gameState.player1Id === playerId) {
        throw new Error('Cannot join your own game');
      }

      if (gameState.player2Id) {
        throw new Error('Game is already full');
      }

      // Update game state
      gameState.player2Id = playerId;
      gameState.status = 'active';
      gameState.lastMoveAt = Date.now();

      // Update in memory
      this.activeGames.set(gameId, gameState);

      // Persist changes
      await this.saveGameState(gameState);
      await this.cacheManager.setGameState(gameId, gameState.toJSON());

      // Clear waiting timeout and set active game timeout
      this.clearGameTimeout(gameId);
      this.setGameTimeout(gameId);

      logger.info(`Player ${playerId} joined game ${gameId}`);

      return gameState;
    } catch (error) {
      logger.error('Error joining game:', error);
      throw error;
    }
  }

  // Make a move in the game
  async makeMove(gameId, playerId, position) {
    try {
      const gameState = await this.getGameState(gameId);
      
      if (!gameState) {
        throw new Error('Game not found');
      }

      // Validate move
      const validation = this.validator.validateMove(gameState, playerId, position);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Apply move
      const currentPlayerSymbol = gameState.getCurrentPlayerSymbol();
      gameState.board[position] = currentPlayerSymbol;
      
      // Add move to history
      const move = {
        playerId,
        position,
        symbol: currentPlayerSymbol,
        timestamp: Date.now(),
        moveNumber: gameState.moves.length + 1
      };
      gameState.moves.push(move);

      // Check for win or draw
      const gameResult = this.validator.checkGameEnd(gameState.board);
      if (gameResult.isGameOver) {
        gameState.status = 'completed';
        gameState.winner = gameResult.winner;
        gameState.completedAt = Date.now();
        
        // Update player statistics
        await this.updatePlayerStats(gameState);
        
        // Clear game timeout
        this.clearGameTimeout(gameId);
        
        this.stats.gamesCompleted++;
        logger.info(`Game completed: ${gameId}, winner: ${gameResult.winner || 'draw'}`);
      } else {
        // Switch to next player
        gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
        gameState.lastMoveAt = Date.now();
        
        // Reset move timeout
        this.clearGameTimeout(gameId);
        this.setGameTimeout(gameId);
      }

      // Update in memory
      this.activeGames.set(gameId, gameState);

      // Persist changes
      await this.saveGameState(gameState);
      await this.saveMove(gameId, move);
      await this.cacheManager.setGameState(gameId, gameState.toJSON());

      this.stats.totalMoves++;

      return {
        gameState,
        move,
        gameResult
      };
    } catch (error) {
      logger.error('Error making move:', error);
      throw error;
    }
  }

  // Get game state
  async getGameState(gameId) {
    try {
      // Try memory first
      if (this.activeGames.has(gameId)) {
        return this.activeGames.get(gameId);
      }

      // Try cache
      const cachedState = await this.cacheManager.getGameState(gameId);
      if (cachedState) {
        const gameState = GameState.fromJSON(cachedState);
        this.activeGames.set(gameId, gameState);
        return gameState;
      }

      // Try database
      const dbState = await this.dbManager.getGameState(gameId);
      if (dbState) {
        const gameState = GameState.fromDatabaseRow(dbState);
        this.activeGames.set(gameId, gameState);
        await this.cacheManager.setGameState(gameId, gameState.toJSON());
        return gameState;
      }

      return null;
    } catch (error) {
      logger.error('Error getting game state:', error);
      throw error;
    }
  }

  // Add spectator to game
  async addSpectator(gameId, spectatorId) {
    try {
      const gameState = await this.getGameState(gameId);
      
      if (!gameState) {
        throw new Error('Game not found');
      }

      if (!gameState.gameOptions.allowSpectators) {
        throw new Error('Spectators not allowed for this game');
      }

      if (gameState.spectators.length >= config.game.maxSpectators) {
        throw new Error('Maximum spectators reached');
      }

      if (gameState.spectators.includes(spectatorId)) {
        return gameState; // Already spectating
      }

      gameState.spectators.push(spectatorId);

      // Update in memory and cache
      this.activeGames.set(gameId, gameState);
      await this.cacheManager.setGameState(gameId, gameState.toJSON());

      logger.info(`Spectator ${spectatorId} added to game ${gameId}`);

      return gameState;
    } catch (error) {
      logger.error('Error adding spectator:', error);
      throw error;
    }
  }

  // Remove spectator from game
  async removeSpectator(gameId, spectatorId) {
    try {
      const gameState = await this.getGameState(gameId);
      
      if (!gameState) {
        return;
      }

      const index = gameState.spectators.indexOf(spectatorId);
      if (index > -1) {
        gameState.spectators.splice(index, 1);

        // Update in memory and cache
        this.activeGames.set(gameId, gameState);
        await this.cacheManager.setGameState(gameId, gameState.toJSON());

        logger.info(`Spectator ${spectatorId} removed from game ${gameId}`);
      }
    } catch (error) {
      logger.error('Error removing spectator:', error);
    }
  }

  // Abandon game (player disconnection)
  async abandonGame(gameId, playerId) {
    try {
      const gameState = await this.getGameState(gameId);
      
      if (!gameState || gameState.status === 'completed') {
        return;
      }

      // Determine winner (opponent of abandoning player)
      let winner = null;
      if (gameState.player1Id === playerId) {
        winner = gameState.player2Id;
      } else if (gameState.player2Id === playerId) {
        winner = gameState.player1Id;
      }

      gameState.status = 'abandoned';
      gameState.winner = winner;
      gameState.completedAt = Date.now();

      // Update player statistics
      await this.updatePlayerStats(gameState);

      // Update in memory and persist
      this.activeGames.set(gameId, gameState);
      await this.saveGameState(gameState);
      await this.cacheManager.setGameState(gameId, gameState.toJSON());

      // Clear timeout
      this.clearGameTimeout(gameId);

      logger.info(`Game ${gameId} abandoned by player ${playerId}`);

      return gameState;
    } catch (error) {
      logger.error('Error abandoning game:', error);
      throw error;
    }
  }

  // Get active games for a player
  async getPlayerGames(playerId) {
    try {
      return await this.dbManager.getPlayerGames(playerId);
    } catch (error) {
      logger.error('Error getting player games:', error);
      throw error;
    }
  }

  // Get game statistics
  getStats() {
    return {
      ...this.stats,
      activeGames: this.activeGames.size,
      memoryUsage: process.memoryUsage()
    };
  }

  // Get active game count
  getActiveGameCount() {
    return this.activeGames.size;
  }

  // Private methods

  async saveGameState(gameState) {
    try {
      await this.dbManager.saveGameState(gameState);
    } catch (error) {
      logger.error('Error saving game state:', error);
      throw error;
    }
  }

  async saveMove(gameId, move) {
    try {
      await this.dbManager.saveMove(gameId, move);
    } catch (error) {
      logger.error('Error saving move:', error);
      throw error;
    }
  }

  async updatePlayerStats(gameState) {
    try {
      const player1Stats = {
        gamesPlayed: 1,
        gamesWon: gameState.winner === gameState.player1Id ? 1 : 0,
        gamesLost: gameState.winner === gameState.player2Id ? 1 : 0,
        gamesDrawn: gameState.winner === null ? 1 : 0
      };

      const player2Stats = {
        gamesPlayed: 1,
        gamesWon: gameState.winner === gameState.player2Id ? 1 : 0,
        gamesLost: gameState.winner === gameState.player1Id ? 1 : 0,
        gamesDrawn: gameState.winner === null ? 1 : 0
      };

      await Promise.all([
        this.dbManager.updatePlayerStats(gameState.player1Id, player1Stats),
        gameState.player2Id ? this.dbManager.updatePlayerStats(gameState.player2Id, player2Stats) : Promise.resolve()
      ]);
    } catch (error) {
      logger.error('Error updating player stats:', error);
    }
  }

  setGameTimeout(gameId) {
    const timeout = setTimeout(async () => {
      try {
        const gameState = await this.getGameState(gameId);
        if (gameState && gameState.status !== 'completed') {
          logger.info(`Game ${gameId} timed out`);
          await this.abandonGame(gameId, null);
        }
      } catch (error) {
        logger.error('Error handling game timeout:', error);
      }
    }, config.game.gameTimeout);

    this.gameTimeouts.set(gameId, timeout);
  }

  clearGameTimeout(gameId) {
    const timeout = this.gameTimeouts.get(gameId);
    if (timeout) {
      clearTimeout(timeout);
      this.gameTimeouts.delete(gameId);
    }
  }

  setupCleanupInterval() {
    // Clean up completed games from memory every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const cleanupThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [gameId, gameState] of this.activeGames.entries()) {
        if (gameState.status === 'completed' && 
            (now - gameState.completedAt) > cleanupThreshold) {
          this.activeGames.delete(gameId);
          this.clearGameTimeout(gameId);
          logger.debug(`Cleaned up completed game from memory: ${gameId}`);
        }
      }
    }, 5 * 60 * 1000);
  }
}

module.exports = GameEngine;