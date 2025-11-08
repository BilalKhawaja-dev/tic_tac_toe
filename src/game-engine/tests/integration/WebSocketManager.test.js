// Integration Tests for WebSocketManager
const WebSocket = require('ws');
const http = require('http');
const WebSocketManager = require('../../src/websocket/WebSocketManager');
const GameEngine = require('../../src/game/GameEngine');

// Mock dependencies
const mockGameEngine = {
  createGame: jest.fn(),
  joinGame: jest.fn(),
  makeMove: jest.fn(),
  getGameState: jest.fn(),
  addSpectator: jest.fn(),
  removeSpectator: jest.fn(),
  abandonGame: jest.fn(),
  getPlayerGames: jest.fn().mockResolvedValue([]),
  getStats: jest.fn().mockReturnValue({ activeGames: 0 })
};

// Mock config
jest.mock('../../src/config', () => ({
  websocket: {
    maxConnections: 1000,
    maxMessageSize: 1024 * 1024,
    pingInterval: 30000,
    messageRateLimit: 100
  },
  game: {
    reconnectionTimeout: 30000
  }
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

describe('WebSocketManager Integration', () => {
  let server;
  let wss;
  let wsManager;
  let port;

  beforeEach((done) => {
    // Create HTTP server
    server = http.createServer();
    
    // Create WebSocket server
    wss = new WebSocket.Server({ server });
    
    // Create WebSocket manager
    wsManager = new WebSocketManager(wss, mockGameEngine);
    wsManager.initialize();

    // Start server on random port
    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterEach((done) => {
    wsManager.shutdown().then(() => {
      server.close(done);
    });
  });

  describe('connection handling', () => {
    it('should accept WebSocket connections', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      
      ws.on('open', () => {
        expect(wsManager.getConnectionCount()).toBe(1);
        ws.close();
      });

      ws.on('close', () => {
        expect(wsManager.getConnectionCount()).toBe(0);
        done();
      });
    });

    it('should send welcome message on connection', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          expect(message.connectionId).toBeDefined();
          expect(message.serverInfo).toBeDefined();
          expect(message.serverInfo.version).toBeDefined();
          ws.close();
          done();
        }
      });
    });

    it('should handle multiple concurrent connections', (done) => {
      const connections = [];
      let connectedCount = 0;
      const totalConnections = 5;

      for (let i = 0; i < totalConnections; i++) {
        const ws = new WebSocket(`ws://localhost:${port}`);
        connections.push(ws);

        ws.on('open', () => {
          connectedCount++;
          if (connectedCount === totalConnections) {
            expect(wsManager.getConnectionCount()).toBe(totalConnections);
            
            // Close all connections
            connections.forEach(conn => conn.close());
          }
        });

        ws.on('close', () => {
          connectedCount--;
          if (connectedCount === 0) {
            expect(wsManager.getConnectionCount()).toBe(0);
            done();
          }
        });
      }
    });
  });

  describe('message handling', () => {
    let ws;
    let connectionId;

    beforeEach((done) => {
      ws = new WebSocket(`ws://localhost:${port}`);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection_established') {
          connectionId = message.connectionId;
          done();
        }
      });
    });

    afterEach(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should handle valid JSON messages', (done) => {
      const testMessage = {
        type: 'ping',
        id: 'test-message-1',
        data: { test: true }
      };

      ws.send(JSON.stringify(testMessage));

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'pong') {
          expect(message.requestId).toBe(testMessage.id);
          done();
        }
      });
    });

    it('should reject invalid JSON messages', (done) => {
      ws.send('invalid json');

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          expect(message.error.code).toBe('INVALID_JSON');
          done();
        }
      });
    });

    it('should reject messages without required fields', (done) => {
      const invalidMessage = { data: 'missing type and id' };
      ws.send(JSON.stringify(invalidMessage));

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          expect(message.error.code).toBe('INVALID_MESSAGE');
          done();
        }
      });
    });

    it('should handle authentication messages', (done) => {
      const authMessage = {
        type: 'authenticate',
        id: 'auth-1',
        data: {
          playerId: 'test-player',
          token: 'valid-token'
        }
      };

      // Mock successful authentication
      jest.spyOn(wsManager.messageHandler, 'handleMessage').mockImplementation(async (connId, message) => {
        if (message.type === 'authenticate') {
          wsManager.authenticatePlayer(connId, 'test-player');
          wsManager.sendMessage(connId, {
            type: 'authenticated',
            requestId: message.id,
            data: { playerId: 'test-player' }
          });
        }
      });

      ws.send(JSON.stringify(authMessage));

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'authenticated') {
          expect(message.data.playerId).toBe('test-player');
          done();
        }
      });
    });
  });

  describe('game subscription', () => {
    let ws1, ws2;
    let connectionId1, connectionId2;

    beforeEach((done) => {
      let connectedCount = 0;

      ws1 = new WebSocket(`ws://localhost:${port}`);
      ws2 = new WebSocket(`ws://localhost:${port}`);

      ws1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection_established') {
          connectionId1 = message.connectionId;
          connectedCount++;
          if (connectedCount === 2) done();
        }
      });

      ws2.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection_established') {
          connectionId2 = message.connectionId;
          connectedCount++;
          if (connectedCount === 2) done();
        }
      });
    });

    afterEach(() => {
      if (ws1.readyState === WebSocket.OPEN) ws1.close();
      if (ws2.readyState === WebSocket.OPEN) ws2.close();
    });

    it('should allow subscription to game updates', () => {
      const gameId = 'test-game-123';
      
      expect(wsManager.subscribeToGame(connectionId1, gameId)).toBe(true);
      expect(wsManager.subscribeToGame(connectionId2, gameId)).toBe(true);

      const subscribers = wsManager.gameSubscriptions.get(gameId);
      expect(subscribers.size).toBe(2);
      expect(subscribers.has(connectionId1)).toBe(true);
      expect(subscribers.has(connectionId2)).toBe(true);
    });

    it('should broadcast messages to game subscribers', (done) => {
      const gameId = 'test-game-123';
      wsManager.subscribeToGame(connectionId1, gameId);
      wsManager.subscribeToGame(connectionId2, gameId);

      const broadcastMessage = {
        type: 'game_update',
        gameId,
        data: { board: ['X', null, null, null, null, null, null, null, null] }
      };

      let receivedCount = 0;

      const messageHandler = (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'game_update') {
          receivedCount++;
          if (receivedCount === 2) {
            done();
          }
        }
      };

      ws1.on('message', messageHandler);
      ws2.on('message', messageHandler);

      wsManager.broadcastToGame(gameId, broadcastMessage);
    });

    it('should unsubscribe from game updates', () => {
      const gameId = 'test-game-123';
      
      wsManager.subscribeToGame(connectionId1, gameId);
      wsManager.subscribeToGame(connectionId2, gameId);
      
      expect(wsManager.gameSubscriptions.get(gameId).size).toBe(2);
      
      wsManager.unsubscribeFromGame(connectionId1, gameId);
      
      expect(wsManager.gameSubscriptions.get(gameId).size).toBe(1);
      expect(wsManager.gameSubscriptions.get(gameId).has(connectionId2)).toBe(true);
    });
  });

  describe('rate limiting', () => {
    let ws;

    beforeEach((done) => {
      ws = new WebSocket(`ws://localhost:${port}`);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection_established') {
          done();
        }
      });
    });

    afterEach(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should enforce rate limiting', (done) => {
      let errorReceived = false;

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error' && message.error.code === 'RATE_LIMIT_EXCEEDED') {
          errorReceived = true;
          done();
        }
      });

      // Send messages rapidly to trigger rate limit
      for (let i = 0; i < 150; i++) { // Exceeds limit of 100
        ws.send(JSON.stringify({
          type: 'ping',
          id: `ping-${i}`
        }));
      }

      // If no rate limit error after 1 second, fail the test
      setTimeout(() => {
        if (!errorReceived) {
          done(new Error('Rate limiting not enforced'));
        }
      }, 1000);
    });
  });

  describe('heartbeat mechanism', () => {
    let ws;

    beforeEach((done) => {
      ws = new WebSocket(`ws://localhost:${port}`);
      ws.on('open', done);
    });

    afterEach(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should respond to ping with pong', (done) => {
      ws.on('ping', () => {
        ws.pong();
        done();
      });

      // Manually trigger ping
      ws.ping();
    });

    it('should terminate inactive connections', (done) => {
      // Mock the heartbeat interval to be very short for testing
      const originalInterval = wsManager.heartbeatInterval;
      clearInterval(originalInterval);

      wsManager.heartbeatInterval = setInterval(() => {
        wsManager.wss.clients.forEach((client) => {
          let connectionInfo = null;
          for (const [id, info] of wsManager.connections.entries()) {
            if (info.ws === client) {
              connectionInfo = info;
              break;
            }
          }

          if (connectionInfo && !connectionInfo.isAlive) {
            client.terminate();
            return;
          }

          if (connectionInfo) {
            connectionInfo.isAlive = false;
            client.ping();
          }
        });
      }, 100); // Very short interval for testing

      ws.on('close', () => {
        clearInterval(wsManager.heartbeatInterval);
        wsManager.heartbeatInterval = originalInterval;
        done();
      });

      // Don't respond to pings to simulate inactive connection
      ws.on('ping', () => {
        // Don't send pong
      });
    });
  });

  describe('connection cleanup', () => {
    it('should clean up connection data on disconnect', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      let connectionId;

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection_established') {
          connectionId = message.connectionId;
          
          // Authenticate and subscribe to a game
          wsManager.authenticatePlayer(connectionId, 'test-player');
          wsManager.subscribeToGame(connectionId, 'test-game');
          
          expect(wsManager.connections.has(connectionId)).toBe(true);
          expect(wsManager.playerConnections.get('test-player')).toBe(connectionId);
          
          ws.close();
        }
      });

      ws.on('close', () => {
        // Give some time for cleanup
        setTimeout(() => {
          expect(wsManager.connections.has(connectionId)).toBe(false);
          expect(wsManager.playerConnections.has('test-player')).toBe(false);
          done();
        }, 100);
      });
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket errors gracefully', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      
      ws.on('open', () => {
        // Force an error by sending invalid data
        ws._socket.write('invalid websocket frame');
      });

      ws.on('error', () => {
        // Error should be handled gracefully
        done();
      });
    });

    it('should handle message processing errors', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      
      // Mock message handler to throw error
      const originalHandler = wsManager.messageHandler.handleMessage;
      wsManager.messageHandler.handleMessage = jest.fn().mockRejectedValue(new Error('Processing error'));

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connection_established') {
          ws.send(JSON.stringify({
            type: 'test',
            id: 'test-1'
          }));
        } else if (message.type === 'error' && message.error.code === 'MESSAGE_PROCESSING_ERROR') {
          wsManager.messageHandler.handleMessage = originalHandler;
          done();
        }
      });
    });
  });

  describe('statistics', () => {
    it('should provide accurate connection statistics', (done) => {
      const connections = [];
      const totalConnections = 3;
      let connectedCount = 0;

      for (let i = 0; i < totalConnections; i++) {
        const ws = new WebSocket(`ws://localhost:${port}`);
        connections.push(ws);

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            // Authenticate one connection
            if (i === 0) {
              wsManager.authenticatePlayer(message.connectionId, `player-${i}`);
            }
            
            connectedCount++;
            if (connectedCount === totalConnections) {
              const stats = wsManager.getConnectionStats();
              
              expect(stats.totalConnections).toBe(totalConnections);
              expect(stats.authenticatedConnections).toBe(1);
              expect(stats.activeConnections).toBe(totalConnections);
              
              connections.forEach(conn => conn.close());
              done();
            }
          }
        });
      }
    });
  });
});