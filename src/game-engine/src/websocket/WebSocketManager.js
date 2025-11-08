// WebSocket Connection Manager for Real-time Game Updates
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');
const MessageHandler = require('./MessageHandler');
const ConnectionManager = require('./ConnectionManager');

class WebSocketManager {
  constructor(wss, gameEngine) {
    this.wss = wss;
    this.gameEngine = gameEngine;
    this.connectionManager = new ConnectionManager();
    this.messageHandler = new MessageHandler(gameEngine, this.connectionManager);
    
    // Connection tracking
    this.connections = new Map(); // connectionId -> connection info
    this.playerConnections = new Map(); // playerId -> connectionId
    this.gameSubscriptions = new Map(); // gameId -> Set of connectionIds
    
    // Rate limiting
    this.messageCounts = new Map(); // connectionId -> { count, resetTime }
    
    // Heartbeat tracking
    this.heartbeatInterval = null;
    
    this.isShuttingDown = false;
  }

  initialize() {
    logger.info('Initializing WebSocket Manager...');

    // Set up WebSocket server event handlers
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });

    // Start heartbeat interval
    this.startHeartbeat();

    // Set up cleanup interval
    this.startCleanupInterval();

    logger.info('WebSocket Manager initialized');
  }

  handleConnection(ws, request) {
    if (this.isShuttingDown) {
      ws.close(1001, 'Server shutting down');
      return;
    }

    // Check connection limit
    if (this.connections.size >= config.websocket.maxConnections) {
      logger.warn('Maximum WebSocket connections reached');
      ws.close(1008, 'Server at capacity');
      return;
    }

    const connectionId = uuidv4();
    const clientIP = this.getClientIP(request);
    
    const connectionInfo = {
      id: connectionId,
      ws,
      playerId: null,
      authenticated: false,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      clientIP,
      userAgent: request.headers['user-agent'] || 'Unknown',
      gameSubscriptions: new Set(),
      isAlive: true
    };

    // Store connection
    this.connections.set(connectionId, connectionInfo);

    logger.info(`WebSocket connection established: ${connectionId} from ${clientIP}`);

    // Set up connection event handlers
    this.setupConnectionHandlers(connectionInfo);

    // Send welcome message
    this.sendMessage(connectionId, {
      type: 'connection_established',
      connectionId,
      timestamp: Date.now(),
      serverInfo: {
        version: process.env.npm_package_version || '1.0.0',
        maxMessageSize: config.websocket.maxMessageSize,
        pingInterval: config.websocket.pingInterval
      }
    });
  }

  setupConnectionHandlers(connectionInfo) {
    const { id: connectionId, ws } = connectionInfo;

    // Message handler
    ws.on('message', async (data) => {
      try {
        await this.handleMessage(connectionId, data);
      } catch (error) {
        logger.error(`Error handling message from ${connectionId}:`, error);
        this.sendError(connectionId, 'MESSAGE_PROCESSING_ERROR', 'Failed to process message');
      }
    });

    // Pong handler (heartbeat response)
    ws.on('pong', () => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.isAlive = true;
        connection.lastActivity = Date.now();
      }
    });

    // Close handler
    ws.on('close', (code, reason) => {
      this.handleDisconnection(connectionId, code, reason);
    });

    // Error handler
    ws.on('error', (error) => {
      logger.error(`WebSocket error for connection ${connectionId}:`, error);
      this.handleDisconnection(connectionId, 1006, 'Connection error');
    });
  }

  async handleMessage(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Update activity timestamp
    connection.lastActivity = Date.now();

    // Check message size
    if (data.length > config.websocket.maxMessageSize) {
      this.sendError(connectionId, 'MESSAGE_TOO_LARGE', 'Message exceeds maximum size');
      return;
    }

    // Rate limiting
    if (!this.checkRateLimit(connectionId)) {
      this.sendError(connectionId, 'RATE_LIMIT_EXCEEDED', 'Too many messages');
      return;
    }

    // Parse message
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      this.sendError(connectionId, 'INVALID_JSON', 'Invalid JSON format');
      return;
    }

    // Validate message structure
    if (!message.type || !message.id) {
      this.sendError(connectionId, 'INVALID_MESSAGE', 'Message must have type and id fields');
      return;
    }

    logger.debug(`Received message from ${connectionId}:`, message.type);

    // Handle message through message handler
    try {
      await this.messageHandler.handleMessage(connectionId, message);
    } catch (error) {
      logger.error(`Message handler error for ${connectionId}:`, error);
      this.sendError(connectionId, 'HANDLER_ERROR', error.message);
    }
  }

  handleDisconnection(connectionId, code, reason) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    logger.info(`WebSocket disconnection: ${connectionId}, code: ${code}, reason: ${reason}`);

    // Remove from player connections
    if (connection.playerId) {
      this.playerConnections.delete(connection.playerId);
      
      // Notify game engine about disconnection
      this.notifyPlayerDisconnection(connection.playerId);
    }

    // Remove from game subscriptions
    for (const gameId of connection.gameSubscriptions) {
      const subscribers = this.gameSubscriptions.get(gameId);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this.gameSubscriptions.delete(gameId);
        }
      }
    }

    // Remove connection
    this.connections.delete(connectionId);
    this.messageCounts.delete(connectionId);
  }

  // Send message to a specific connection
  sendMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const messageString = JSON.stringify({
        ...message,
        timestamp: message.timestamp || Date.now()
      });
      
      connection.ws.send(messageString);
      return true;
    } catch (error) {
      logger.error(`Error sending message to ${connectionId}:`, error);
      return false;
    }
  }

  // Send error message
  sendError(connectionId, errorCode, errorMessage, requestId = null) {
    this.sendMessage(connectionId, {
      type: 'error',
      error: {
        code: errorCode,
        message: errorMessage
      },
      requestId
    });
  }

  // Broadcast message to multiple connections
  broadcast(connectionIds, message) {
    let successCount = 0;
    
    for (const connectionId of connectionIds) {
      if (this.sendMessage(connectionId, message)) {
        successCount++;
      }
    }
    
    return successCount;
  }

  // Send message to a specific player
  sendToPlayer(playerId, message) {
    const connectionId = this.playerConnections.get(playerId);
    if (connectionId) {
      return this.sendMessage(connectionId, message);
    }
    return false;
  }

  // Broadcast to all subscribers of a game
  broadcastToGame(gameId, message, excludeConnectionId = null) {
    const subscribers = this.gameSubscriptions.get(gameId);
    if (!subscribers) {
      return 0;
    }

    const connectionIds = Array.from(subscribers).filter(id => id !== excludeConnectionId);
    return this.broadcast(connectionIds, message);
  }

  // Subscribe connection to game updates
  subscribeToGame(connectionId, gameId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Add to connection's subscriptions
    connection.gameSubscriptions.add(gameId);

    // Add to game's subscribers
    if (!this.gameSubscriptions.has(gameId)) {
      this.gameSubscriptions.set(gameId, new Set());
    }
    this.gameSubscriptions.get(gameId).add(connectionId);

    logger.debug(`Connection ${connectionId} subscribed to game ${gameId}`);
    return true;
  }

  // Unsubscribe connection from game updates
  unsubscribeFromGame(connectionId, gameId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.gameSubscriptions.delete(gameId);
    }

    const subscribers = this.gameSubscriptions.get(gameId);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.gameSubscriptions.delete(gameId);
      }
    }

    logger.debug(`Connection ${connectionId} unsubscribed from game ${gameId}`);
  }

  // Associate connection with a player
  authenticatePlayer(connectionId, playerId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Remove old connection for this player if exists
    const oldConnectionId = this.playerConnections.get(playerId);
    if (oldConnectionId && oldConnectionId !== connectionId) {
      const oldConnection = this.connections.get(oldConnectionId);
      if (oldConnection) {
        oldConnection.playerId = null;
        oldConnection.authenticated = false;
        this.sendMessage(oldConnectionId, {
          type: 'session_replaced',
          message: 'Your session has been replaced by a new connection'
        });
      }
    }

    // Set new connection
    connection.playerId = playerId;
    connection.authenticated = true;
    this.playerConnections.set(playerId, connectionId);

    logger.info(`Player ${playerId} authenticated on connection ${connectionId}`);
    return true;
  }

  // Check rate limiting
  checkRateLimit(connectionId) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxMessages = config.websocket.messageRateLimit;

    let messageCount = this.messageCounts.get(connectionId);
    if (!messageCount || now > messageCount.resetTime) {
      messageCount = {
        count: 1,
        resetTime: now + windowMs
      };
      this.messageCounts.set(connectionId, messageCount);
      return true;
    }

    if (messageCount.count >= maxMessages) {
      return false;
    }

    messageCount.count++;
    return true;
  }

  // Get client IP address
  getClientIP(request) {
    return request.headers['x-forwarded-for'] || 
           request.headers['x-real-ip'] || 
           request.connection.remoteAddress || 
           request.socket.remoteAddress ||
           'unknown';
  }

  // Start heartbeat mechanism
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        // Find connection info
        let connectionInfo = null;
        for (const [id, info] of this.connections.entries()) {
          if (info.ws === ws) {
            connectionInfo = info;
            break;
          }
        }

        if (!connectionInfo) {
          return;
        }

        if (!connectionInfo.isAlive) {
          logger.debug(`Terminating inactive connection: ${connectionInfo.id}`);
          ws.terminate();
          return;
        }

        connectionInfo.isAlive = false;
        ws.ping();
      });
    }, config.websocket.pingInterval);
  }

  // Start cleanup interval
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes

      // Clean up inactive connections
      for (const [connectionId, connection] of this.connections.entries()) {
        if (now - connection.lastActivity > timeout) {
          logger.debug(`Cleaning up inactive connection: ${connectionId}`);
          connection.ws.terminate();
        }
      }

      // Clean up old message counts
      for (const [connectionId, messageCount] of this.messageCounts.entries()) {
        if (now > messageCount.resetTime) {
          this.messageCounts.delete(connectionId);
        }
      }
    }, 60 * 1000); // Run every minute
  }

  // Notify game engine about player disconnection
  async notifyPlayerDisconnection(playerId) {
    try {
      // This could trigger game abandonment or reconnection timeout
      logger.info(`Player ${playerId} disconnected, checking active games...`);
      
      // Get player's active games and handle disconnection
      const playerGames = await this.gameEngine.getPlayerGames(playerId);
      for (const game of playerGames) {
        if (game.status === 'active') {
          // Start reconnection timeout
          setTimeout(async () => {
            const currentConnection = this.playerConnections.get(playerId);
            if (!currentConnection) {
              logger.info(`Player ${playerId} did not reconnect, abandoning game ${game.gameId}`);
              await this.gameEngine.abandonGame(game.gameId, playerId);
            }
          }, config.game.reconnectionTimeout);
        }
      }
    } catch (error) {
      logger.error('Error handling player disconnection:', error);
    }
  }

  // Get connection statistics
  getConnectionStats() {
    const now = Date.now();
    let authenticatedCount = 0;
    let activeCount = 0;

    for (const connection of this.connections.values()) {
      if (connection.authenticated) {
        authenticatedCount++;
      }
      if (now - connection.lastActivity < 60000) { // Active in last minute
        activeCount++;
      }
    }

    return {
      totalConnections: this.connections.size,
      authenticatedConnections: authenticatedCount,
      activeConnections: activeCount,
      gameSubscriptions: this.gameSubscriptions.size,
      playerConnections: this.playerConnections.size
    };
  }

  // Get connection count
  getConnectionCount() {
    return this.connections.size;
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down WebSocket Manager...');
    this.isShuttingDown = true;

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections gracefully
    const closePromises = [];
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1001, 'Server shutting down');
        closePromises.push(
          new Promise((resolve) => {
            connection.ws.on('close', resolve);
            setTimeout(resolve, 5000); // Force close after 5 seconds
          })
        );
      }
    }

    // Wait for all connections to close
    await Promise.all(closePromises);

    // Clear all data structures
    this.connections.clear();
    this.playerConnections.clear();
    this.gameSubscriptions.clear();
    this.messageCounts.clear();

    logger.info('WebSocket Manager shutdown completed');
  }
}

module.exports = WebSocketManager;