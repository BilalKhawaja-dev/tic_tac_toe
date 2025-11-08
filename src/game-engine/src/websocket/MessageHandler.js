// WebSocket Message Handler - Processes incoming WebSocket messages
const logger = require('../utils/logger');
const Joi = require('joi');

class MessageHandler {
  constructor(gameEngine, connectionManager) {
    this.gameEngine = gameEngine;
    this.connectionManager = connectionManager;
    
    // Message schemas for validation
    this.schemas = this.defineSchemas();
    
    // Message handlers
    this.handlers = {
      'authenticate': this.handleAuthenticate.bind(this),
      'create_game': this.handleCreateGame.bind(this),
      'join_game': this.handleJoinGame.bind(this),
      'make_move': this.handleMakeMove.bind(this),
      'subscribe_game': this.handleSubscribeGame.bind(this),
      'unsubscribe_game': this.handleUnsubscribeGame.bind(this),
      'get_game_state': this.handleGetGameState.bind(this),
      'get_player_games': this.handleGetPlayerGames.bind(this),
      'abandon_game': this.handleAbandonGame.bind(this),
      'ping': this.handlePing.bind(this),
      'get_stats': this.handleGetStats.bind(this)
    };
  }

  defineSchemas() {
    return {
      authenticate: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object({
          playerId: Joi.string().required(),
          token: Joi.string().optional() // JWT token for authentication
        }).required()
      }),

      create_game: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object({
          gameOptions: Joi.object({
            timeLimit: Joi.number().min(30000).max(600000).optional(),
            allowSpectators: Joi.boolean().optional()
          }).optional()
        }).optional()
      }),

      join_game: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object({
          gameId: Joi.string().required()
        }).required()
      }),

      make_move: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object({
          gameId: Joi.string().required(),
          position: Joi.number().integer().min(0).max(8).required()
        }).required()
      }),

      subscribe_game: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object({
          gameId: Joi.string().required()
        }).required()
      }),

      unsubscribe_game: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object({
          gameId: Joi.string().required()
        }).required()
      }),

      get_game_state: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object({
          gameId: Joi.string().required()
        }).required()
      }),

      get_player_games: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object().optional()
      }),

      abandon_game: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object({
          gameId: Joi.string().required()
        }).required()
      }),

      ping: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object().optional()
      }),

      get_stats: Joi.object({
        type: Joi.string().required(),
        id: Joi.string().required(),
        data: Joi.object().optional()
      })
    };
  }

  async handleMessage(connectionId, message) {
    const { type, id: messageId } = message;

    // Check if handler exists
    if (!this.handlers[type]) {
      this.sendError(connectionId, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${type}`, messageId);
      return;
    }

    // Validate message schema
    const schema = this.schemas[type];
    if (schema) {
      const { error } = schema.validate(message);
      if (error) {
        this.sendError(connectionId, 'VALIDATION_ERROR', error.details[0].message, messageId);
        return;
      }
    }

    // Check authentication for protected endpoints
    if (this.requiresAuthentication(type)) {
      const connection = this.connectionManager.connections.get(connectionId);
      if (!connection || !connection.authenticated) {
        this.sendError(connectionId, 'AUTHENTICATION_REQUIRED', 'This action requires authentication', messageId);
        return;
      }
    }

    try {
      await this.handlers[type](connectionId, message);
    } catch (error) {
      logger.error(`Error handling ${type} message:`, error);
      this.sendError(connectionId, 'HANDLER_ERROR', error.message, messageId);
    }
  }

  requiresAuthentication(messageType) {
    const publicMessages = ['authenticate', 'ping'];
    return !publicMessages.includes(messageType);
  }

  // Message Handlers

  async handleAuthenticate(connectionId, message) {
    const { id: messageId, data } = message;
    const { playerId, token } = data;

    try {
      // TODO: Validate JWT token if provided
      // For now, we'll accept any playerId for development
      
      // Authenticate the connection
      const success = this.connectionManager.authenticatePlayer(connectionId, playerId);
      
      if (success) {
        this.sendResponse(connectionId, messageId, {
          success: true,
          playerId,
          message: 'Authentication successful'
        });

        logger.info(`Player ${playerId} authenticated successfully`);
      } else {
        this.sendError(connectionId, 'AUTHENTICATION_FAILED', 'Failed to authenticate player', messageId);
      }
    } catch (error) {
      this.sendError(connectionId, 'AUTHENTICATION_ERROR', error.message, messageId);
    }
  }

  async handleCreateGame(connectionId, message) {
    const { id: messageId, data = {} } = message;
    const connection = this.connectionManager.connections.get(connectionId);
    
    try {
      const gameState = await this.gameEngine.createGame(connection.playerId, data.gameOptions);
      
      // Subscribe creator to game updates
      this.connectionManager.subscribeToGame(connectionId, gameState.gameId);
      
      this.sendResponse(connectionId, messageId, {
        success: true,
        game: gameState.toClientJSON(connection.playerId)
      });

      // Broadcast game created event
      this.broadcastGameUpdate(gameState.gameId, {
        type: 'game_created',
        game: gameState.toClientJSON()
      });

      logger.info(`Game created: ${gameState.gameId} by player: ${connection.playerId}`);
    } catch (error) {
      this.sendError(connectionId, 'GAME_CREATION_FAILED', error.message, messageId);
    }
  }

  async handleJoinGame(connectionId, message) {
    const { id: messageId, data } = message;
    const { gameId } = data;
    const connection = this.connectionManager.connections.get(connectionId);
    
    try {
      const gameState = await this.gameEngine.joinGame(gameId, connection.playerId);
      
      // Subscribe player to game updates
      this.connectionManager.subscribeToGame(connectionId, gameId);
      
      this.sendResponse(connectionId, messageId, {
        success: true,
        game: gameState.toClientJSON(connection.playerId)
      });

      // Broadcast game joined event to all subscribers
      this.broadcastGameUpdate(gameId, {
        type: 'player_joined',
        game: gameState.toClientJSON(),
        playerId: connection.playerId
      }, connectionId);

      logger.info(`Player ${connection.playerId} joined game ${gameId}`);
    } catch (error) {
      this.sendError(connectionId, 'JOIN_GAME_FAILED', error.message, messageId);
    }
  }

  async handleMakeMove(connectionId, message) {
    const { id: messageId, data } = message;
    const { gameId, position } = data;
    const connection = this.connectionManager.connections.get(connectionId);
    
    try {
      const result = await this.gameEngine.makeMove(gameId, connection.playerId, position);
      const { gameState, move, gameResult } = result;
      
      this.sendResponse(connectionId, messageId, {
        success: true,
        game: gameState.toClientJSON(connection.playerId),
        move,
        gameResult
      });

      // Broadcast move to all game subscribers
      this.broadcastGameUpdate(gameId, {
        type: 'move_made',
        game: gameState.toClientJSON(),
        move,
        gameResult,
        playerId: connection.playerId
      }, connectionId);

      // If game ended, broadcast game end event
      if (gameResult.isGameOver) {
        this.broadcastGameUpdate(gameId, {
          type: 'game_ended',
          game: gameState.toClientJSON(),
          winner: gameResult.winner,
          winningCombination: gameResult.winningCombination
        });
      }

      logger.info(`Move made in game ${gameId} by player ${connection.playerId} at position ${position}`);
    } catch (error) {
      this.sendError(connectionId, 'MOVE_FAILED', error.message, messageId);
    }
  }

  async handleSubscribeGame(connectionId, message) {
    const { id: messageId, data } = message;
    const { gameId } = data;
    const connection = this.connectionManager.connections.get(connectionId);
    
    try {
      // Check if game exists
      const gameState = await this.gameEngine.getGameState(gameId);
      if (!gameState) {
        this.sendError(connectionId, 'GAME_NOT_FOUND', 'Game not found', messageId);
        return;
      }

      // Subscribe to game updates
      this.connectionManager.subscribeToGame(connectionId, gameId);
      
      // Add as spectator if not a player
      if (!gameState.isPlayerInGame(connection.playerId)) {
        await this.gameEngine.addSpectator(gameId, connection.playerId);
      }
      
      this.sendResponse(connectionId, messageId, {
        success: true,
        game: gameState.toClientJSON(connection.playerId),
        subscribed: true
      });

      logger.info(`Connection ${connectionId} subscribed to game ${gameId}`);
    } catch (error) {
      this.sendError(connectionId, 'SUBSCRIPTION_FAILED', error.message, messageId);
    }
  }

  async handleUnsubscribeGame(connectionId, message) {
    const { id: messageId, data } = message;
    const { gameId } = data;
    const connection = this.connectionManager.connections.get(connectionId);
    
    try {
      // Unsubscribe from game updates
      this.connectionManager.unsubscribeFromGame(connectionId, gameId);
      
      // Remove as spectator if not a player
      const gameState = await this.gameEngine.getGameState(gameId);
      if (gameState && !gameState.isPlayerInGame(connection.playerId)) {
        await this.gameEngine.removeSpectator(gameId, connection.playerId);
      }
      
      this.sendResponse(connectionId, messageId, {
        success: true,
        gameId,
        unsubscribed: true
      });

      logger.info(`Connection ${connectionId} unsubscribed from game ${gameId}`);
    } catch (error) {
      this.sendError(connectionId, 'UNSUBSCRIPTION_FAILED', error.message, messageId);
    }
  }

  async handleGetGameState(connectionId, message) {
    const { id: messageId, data } = message;
    const { gameId } = data;
    const connection = this.connectionManager.connections.get(connectionId);
    
    try {
      const gameState = await this.gameEngine.getGameState(gameId);
      
      if (!gameState) {
        this.sendError(connectionId, 'GAME_NOT_FOUND', 'Game not found', messageId);
        return;
      }
      
      this.sendResponse(connectionId, messageId, {
        success: true,
        game: gameState.toClientJSON(connection.playerId)
      });
    } catch (error) {
      this.sendError(connectionId, 'GET_GAME_STATE_FAILED', error.message, messageId);
    }
  }

  async handleGetPlayerGames(connectionId, message) {
    const { id: messageId } = message;
    const connection = this.connectionManager.connections.get(connectionId);
    
    try {
      const games = await this.gameEngine.getPlayerGames(connection.playerId);
      
      this.sendResponse(connectionId, messageId, {
        success: true,
        games: games.map(game => ({
          gameId: game.game_id,
          status: game.status,
          opponent: game.player1_id === connection.playerId ? game.player2_id : game.player1_id,
          createdAt: game.started_at,
          lastMoveAt: game.last_move_at,
          completedAt: game.completed_at
        }))
      });
    } catch (error) {
      this.sendError(connectionId, 'GET_PLAYER_GAMES_FAILED', error.message, messageId);
    }
  }

  async handleAbandonGame(connectionId, message) {
    const { id: messageId, data } = message;
    const { gameId } = data;
    const connection = this.connectionManager.connections.get(connectionId);
    
    try {
      const gameState = await this.gameEngine.abandonGame(gameId, connection.playerId);
      
      if (gameState) {
        this.sendResponse(connectionId, messageId, {
          success: true,
          game: gameState.toClientJSON(connection.playerId)
        });

        // Broadcast game abandoned event
        this.broadcastGameUpdate(gameId, {
          type: 'game_abandoned',
          game: gameState.toClientJSON(),
          playerId: connection.playerId
        }, connectionId);
      } else {
        this.sendResponse(connectionId, messageId, {
          success: true,
          message: 'Game not found or already completed'
        });
      }

      logger.info(`Game ${gameId} abandoned by player ${connection.playerId}`);
    } catch (error) {
      this.sendError(connectionId, 'ABANDON_GAME_FAILED', error.message, messageId);
    }
  }

  async handlePing(connectionId, message) {
    const { id: messageId } = message;
    
    this.sendResponse(connectionId, messageId, {
      success: true,
      pong: true,
      serverTime: Date.now()
    });
  }

  async handleGetStats(connectionId, message) {
    const { id: messageId } = message;
    
    try {
      const gameStats = this.gameEngine.getStats();
      const connectionStats = this.connectionManager.getConnectionStats();
      
      this.sendResponse(connectionId, messageId, {
        success: true,
        stats: {
          ...gameStats,
          ...connectionStats
        }
      });
    } catch (error) {
      this.sendError(connectionId, 'GET_STATS_FAILED', error.message, messageId);
    }
  }

  // Helper methods

  sendResponse(connectionId, messageId, data) {
    this.connectionManager.sendMessage(connectionId, {
      type: 'response',
      id: messageId,
      data
    });
  }

  sendError(connectionId, errorCode, errorMessage, messageId = null) {
    this.connectionManager.sendMessage(connectionId, {
      type: 'error',
      id: messageId,
      error: {
        code: errorCode,
        message: errorMessage
      }
    });
  }

  broadcastGameUpdate(gameId, message, excludeConnectionId = null) {
    this.connectionManager.broadcastToGame(gameId, message, excludeConnectionId);
  }
}

module.exports = MessageHandler;