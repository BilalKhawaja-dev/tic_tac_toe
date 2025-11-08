// End-to-End Tests for Complete Game Flow
const WebSocket = require('ws');
const http = require('http');
const GameEngineServer = require('../../src/index');

// Mock external dependencies for E2E tests
jest.mock('../../src/database/DatabaseManager', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    saveGameState: jest.fn().mockResolvedValue(true),
    saveMove: jest.fn().mockResolvedValue(true),
    getGameState: jest.fn().mockResolvedValue(null),
    getPlayerGames: jest.fn().mockResolvedValue([]),
    updatePlayerStats: jest.fn().mockResolvedValue(true)
  }));
});

jest.mock('../../src/cache/CacheManager', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    setGameState: jest.fn().mockResolvedValue(true),
    getGameState: jest.fn().mockResolvedValue(null)
  }));
});

// Mock config for E2E tests
jest.mock('../../src/config', () => ({
  server: {
    port: 0, // Use random port
    shutdownTimeout: 5000
  },
  cors: {
    allowedOrigins: ['http://localhost:3000']
  },
  rateLimit: {
    windowMs: 60000,
    max: 100
  },
  websocket: {
    maxConnections: 1000,
    maxMessageSize: 1024 * 1024,
    pingInterval: 30000,
    messageRateLimit: 100
  },
  game: {
    moveTimeout: 30000,
    gameTimeout: 300000,
    maxSpectators: 10,
    reconnectionTimeout: 30000
  }
}));

describe('Game Flow E2E Tests', () => {
  let server;
  let port;
  let gameEngineServer;

  beforeAll(async () => {
    // Start the game engine server
    gameEngineServer = new GameEngineServer();
    server = await gameEngineServer.start();
    port = server.address().port;
  });

  afterAll(async () => {
    if (gameEngineServer) {
      await gameEngineServer.gracefulShutdown('SIGTERM');
    }
  });

  describe('Complete Game Scenario', () => {
    let player1Ws, player2Ws;
    let player1Id = 'player1';
    let player2Id = 'player2';
    let gameId;

    beforeEach((done) => {
      let connectedCount = 0;

      // Connect player 1
      player1Ws = new WebSocket(`ws://localhost:${port}`);
      player1Ws.on('open', () => {
        connectedCount++;
        if (connectedCount === 2) done();
      });

      // Connect player 2
      player2Ws = new WebSocket(`ws://localhost:${port}`);
      player2Ws.on('open', () => {
        connectedCount++;
        if (connectedCount === 2) done();
      });
    });

    afterEach(() => {
      if (player1Ws.readyState === WebSocket.OPEN) player1Ws.close();
      if (player2Ws.readyState === WebSocket.OPEN) player2Ws.close();
    });

    it('should complete a full game from start to finish', (done) => {
      let gameCreated = false;
      let gameJoined = false;
      let movesPlayed = 0;
      let gameCompleted = false;

      // Player 1 message handler
      player1Ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'connection_established':
            // Authenticate player 1
            player1Ws.send(JSON.stringify({
              type: 'authenticate',
              id: 'auth-1',
              data: { playerId: player1Id, token: 'valid-token' }
            }));
            break;

          case 'authenticated':
            if (message.data.playerId === player1Id) {
              // Create a new game
              player1Ws.send(JSON.stringify({
                type: 'create_game',
                id: 'create-1',
                data: { gameOptions: { allowSpectators: true } }
              }));
            }
            break;

          case 'game_created':
            gameId = message.data.gameId;
            gameCreated = true;
            break;

          case 'game_started':
            if (gameCreated && gameJoined) {
              // Player 1 makes first move (X at position 0)
              player1Ws.send(JSON.stringify({
                type: 'make_move',
                id: 'move-1',
                data: { gameId, position: 0 }
              }));
            }
            break;

          case 'move_made':
            if (message.data.move.playerId === player1Id) {
              movesPlayed++;
            }
            break;

          case 'game_completed':
            gameCompleted = true;
            if (gameCompleted && movesPlayed >= 5) {
              done();
            }
            break;
        }
      });

      // Player 2 message handler
      player2Ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'connection_established':
            // Authenticate player 2
            player2Ws.send(JSON.stringify({
              type: 'authenticate',
              id: 'auth-2',
              data: { playerId: player2Id, token: 'valid-token' }
            }));
            break;

          case 'authenticated':
            if (message.data.playerId === player2Id && gameCreated) {
              // Join the game created by player 1
              player2Ws.send(JSON.stringify({
                type: 'join_game',
                id: 'join-1',
                data: { gameId }
              }));
            }
            break;

          case 'game_joined':
            gameJoined = true;
            break;

          case 'move_made':
            if (message.data.move.playerId === player1Id && movesPlayed === 1) {
              // Player 2 makes second move (O at position 1)
              player2Ws.send(JSON.stringify({
                type: 'make_move',
                id: 'move-2',
                data: { gameId, position: 1 }
              }));
            } else if (message.data.move.playerId === player1Id && movesPlayed === 3) {
              // Player 2 makes fourth move (O at position 4)
              player2Ws.send(JSON.stringify({
                type: 'make_move',
                id: 'move-4',
                data: { gameId, position: 4 }
              }));
            }
            
            if (message.data.move.playerId === player2Id) {
              movesPlayed++;
              
              if (movesPlayed === 2) {
                // Player 1 makes third move (X at position 3)
                player1Ws.send(JSON.stringify({
                  type: 'make_move',
                  id: 'move-3',
                  data: { gameId, position: 3 }
                }));
              } else if (movesPlayed === 4) {
                // Player 1 makes winning move (X at position 6)
                player1Ws.send(JSON.stringify({
                  type: 'make_move',
                  id: 'move-5',
                  data: { gameId, position: 6 }
                }));
              }
            }
            break;
        }
      });
    }, 15000); // Longer timeout for E2E test

    it('should handle player disconnection and reconnection', (done) => {
      let gameCreated = false;
      let playerDisconnected = false;
      let playerReconnected = false;

      // Player 1 creates game and then disconnects
      player1Ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          player1Ws.send(JSON.stringify({
            type: 'authenticate',
            id: 'auth-1',
            data: { playerId: player1Id, token: 'valid-token' }
          }));
        } else if (message.type === 'authenticated') {
          player1Ws.send(JSON.stringify({
            type: 'create_game',
            id: 'create-1',
            data: {}
          }));
        } else if (message.type === 'game_created') {
          gameId = message.data.gameId;
          gameCreated = true;
          
          // Simulate disconnection
          player1Ws.close();
          playerDisconnected = true;
          
          // Reconnect after a short delay
          setTimeout(() => {
            player1Ws = new WebSocket(`ws://localhost:${port}`);
            
            player1Ws.on('message', (reconnectData) => {
              const reconnectMessage = JSON.parse(reconnectData.toString());
              
              if (reconnectMessage.type === 'connection_established') {
                player1Ws.send(JSON.stringify({
                  type: 'authenticate',
                  id: 'auth-reconnect',
                  data: { playerId: player1Id, token: 'valid-token' }
                }));
              } else if (reconnectMessage.type === 'authenticated') {
                playerReconnected = true;
                
                if (gameCreated && playerDisconnected && playerReconnected) {
                  done();
                }
              }
            });
          }, 1000);
        }
      });
    }, 10000);

    it('should handle spectator functionality', (done) => {
      const spectatorId = 'spectator1';
      let spectatorWs;
      let gameCreated = false;
      let spectatorJoined = false;

      // Create game with players
      player1Ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          player1Ws.send(JSON.stringify({
            type: 'authenticate',
            id: 'auth-1',
            data: { playerId: player1Id, token: 'valid-token' }
          }));
        } else if (message.type === 'authenticated') {
          player1Ws.send(JSON.stringify({
            type: 'create_game',
            id: 'create-1',
            data: { gameOptions: { allowSpectators: true } }
          }));
        } else if (message.type === 'game_created') {
          gameId = message.data.gameId;
          gameCreated = true;
          
          // Connect spectator
          spectatorWs = new WebSocket(`ws://localhost:${port}`);
          
          spectatorWs.on('message', (spectatorData) => {
            const spectatorMessage = JSON.parse(spectatorData.toString());
            
            if (spectatorMessage.type === 'connection_established') {
              spectatorWs.send(JSON.stringify({
                type: 'authenticate',
                id: 'auth-spectator',
                data: { playerId: spectatorId, token: 'valid-token' }
              }));
            } else if (spectatorMessage.type === 'authenticated') {
              spectatorWs.send(JSON.stringify({
                type: 'spectate_game',
                id: 'spectate-1',
                data: { gameId }
              }));
            } else if (spectatorMessage.type === 'spectating_game') {
              spectatorJoined = true;
              
              if (gameCreated && spectatorJoined) {
                spectatorWs.close();
                done();
              }
            }
          });
        }
      });
    }, 10000);
  });

  describe('Error Handling', () => {
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

    it('should handle invalid game operations gracefully', (done) => {
      let errorReceived = false;

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          // Try to make a move without authentication
          ws.send(JSON.stringify({
            type: 'make_move',
            id: 'invalid-move',
            data: { gameId: 'non-existent', position: 0 }
          }));
        } else if (message.type === 'error') {
          errorReceived = true;
          expect(message.error.code).toBeDefined();
          expect(message.error.message).toBeDefined();
          done();
        }
      });

      setTimeout(() => {
        if (!errorReceived) {
          done(new Error('Expected error message not received'));
        }
      }, 5000);
    });

    it('should handle malformed messages', (done) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          // Send malformed JSON
          ws.send('{ invalid json }');
        } else if (message.type === 'error' && message.error.code === 'INVALID_JSON') {
          done();
        }
      });
    });
  });

  describe('Performance and Load', () => {
    it('should handle multiple concurrent connections', (done) => {
      const connectionCount = 10;
      const connections = [];
      let connectedCount = 0;

      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`ws://localhost:${port}`);
        connections.push(ws);

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            connectedCount++;
            
            if (connectedCount === connectionCount) {
              // All connections established
              expect(connectedCount).toBe(connectionCount);
              
              // Close all connections
              connections.forEach(conn => conn.close());
              done();
            }
          }
        });
      }
    }, 15000);

    it('should handle rapid message sending', (done) => {
      let messageCount = 0;
      const totalMessages = 50;

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection_established') {
          // Send multiple messages rapidly
          for (let i = 0; i < totalMessages; i++) {
            ws.send(JSON.stringify({
              type: 'ping',
              id: `ping-${i}`,
              data: { sequence: i }
            }));
          }
        } else if (message.type === 'pong' || message.type === 'error') {
          messageCount++;
          
          if (messageCount >= totalMessages || message.type === 'error') {
            // Should handle all messages or rate limit appropriately
            expect(messageCount).toBeGreaterThan(0);
            done();
          }
        }
      });
    }, 10000);
  });
});