// Connection Manager - Manages WebSocket connections and their lifecycle
const logger = require('../utils/logger');

class ConnectionManager {
  constructor() {
    // Connection tracking
    this.connections = new Map(); // connectionId -> connection info
    this.playerConnections = new Map(); // playerId -> connectionId
    this.gameSubscriptions = new Map(); // gameId -> Set of connectionIds
  }

  // Get connection by ID
  getConnection(connectionId) {
    return this.connections.get(connectionId);
  }

  // Get connection by player ID
  getConnectionByPlayer(playerId) {
    const connectionId = this.playerConnections.get(playerId);
    return connectionId ? this.connections.get(connectionId) : null;
  }

  // Add new connection
  addConnection(connectionInfo) {
    this.connections.set(connectionInfo.id, connectionInfo);
    logger.debug(`Connection added: ${connectionInfo.id}`);
  }

  // Remove connection
  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Remove from player connections
    if (connection.playerId) {
      this.playerConnections.delete(connection.playerId);
    }

    // Remove from game subscriptions
    for (const gameId of connection.gameSubscriptions) {
      this.unsubscribeFromGame(connectionId, gameId);
    }

    // Remove connection
    this.connections.delete(connectionId);
    logger.debug(`Connection removed: ${connectionId}`);
    return true;
  }

  // Authenticate player on connection
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

    logger.debug(`Player ${playerId} authenticated on connection ${connectionId}`);
    return true;
  }

  // Send message to specific connection
  sendMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== 1) { // WebSocket.OPEN = 1
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

  // Send message to player
  sendToPlayer(playerId, message) {
    const connectionId = this.playerConnections.get(playerId);
    if (connectionId) {
      return this.sendMessage(connectionId, message);
    }
    return false;
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

  // Broadcast to all subscribers of a game
  broadcastToGame(gameId, message, excludeConnectionId = null) {
    const subscribers = this.gameSubscriptions.get(gameId);
    if (!subscribers) {
      return 0;
    }

    const connectionIds = Array.from(subscribers).filter(id => id !== excludeConnectionId);
    return this.broadcast(connectionIds, message);
  }

  // Get game subscribers
  getGameSubscribers(gameId) {
    const subscribers = this.gameSubscriptions.get(gameId);
    return subscribers ? Array.from(subscribers) : [];
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

  // Get all connections for a player (in case of multiple devices)
  getPlayerConnections(playerId) {
    const connections = [];
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.playerId === playerId) {
        connections.push(connectionId);
      }
    }
    return connections;
  }

  // Check if player is online
  isPlayerOnline(playerId) {
    return this.playerConnections.has(playerId);
  }

  // Get online players
  getOnlinePlayers() {
    return Array.from(this.playerConnections.keys());
  }

  // Get connection info for debugging
  getConnectionInfo(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }

    return {
      id: connection.id,
      playerId: connection.playerId,
      authenticated: connection.authenticated,
      connectedAt: connection.connectedAt,
      lastActivity: connection.lastActivity,
      clientIP: connection.clientIP,
      userAgent: connection.userAgent,
      gameSubscriptions: Array.from(connection.gameSubscriptions),
      isAlive: connection.isAlive
    };
  }

  // Clean up inactive connections
  cleanupInactiveConnections(timeoutMs = 5 * 60 * 1000) {
    const now = Date.now();
    const inactiveConnections = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastActivity > timeoutMs) {
        inactiveConnections.push(connectionId);
      }
    }

    for (const connectionId of inactiveConnections) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        logger.debug(`Cleaning up inactive connection: ${connectionId}`);
        connection.ws.terminate();
        this.removeConnection(connectionId);
      }
    }

    return inactiveConnections.length;
  }

  // Update connection activity
  updateActivity(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
      connection.isAlive = true;
    }
  }

  // Get connections by game
  getConnectionsByGame(gameId) {
    const subscribers = this.gameSubscriptions.get(gameId);
    if (!subscribers) {
      return [];
    }

    const connections = [];
    for (const connectionId of subscribers) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connections.push(connection);
      }
    }

    return connections;
  }

  // Notify all connections of server event
  broadcastServerEvent(eventType, data) {
    const message = {
      type: 'server_event',
      eventType,
      data,
      timestamp: Date.now()
    };

    let successCount = 0;
    for (const connectionId of this.connections.keys()) {
      if (this.sendMessage(connectionId, message)) {
        successCount++;
      }
    }

    logger.info(`Broadcasted ${eventType} event to ${successCount} connections`);
    return successCount;
  }

  // Get summary for monitoring
  getSummary() {
    const stats = this.getConnectionStats();
    const gameStats = {};

    // Count subscribers per game
    for (const [gameId, subscribers] of this.gameSubscriptions.entries()) {
      gameStats[gameId] = subscribers.size;
    }

    return {
      ...stats,
      gamesWithSubscribers: Object.keys(gameStats).length,
      averageSubscribersPerGame: Object.keys(gameStats).length > 0 
        ? Object.values(gameStats).reduce((a, b) => a + b, 0) / Object.keys(gameStats).length 
        : 0
    };
  }
}

module.exports = ConnectionManager;