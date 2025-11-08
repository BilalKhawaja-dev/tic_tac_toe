// Game State Management Class
class GameState {
  constructor(data = {}) {
    this.gameId = data.gameId;
    this.player1Id = data.player1Id;
    this.player2Id = data.player2Id || null;
    this.status = data.status || 'waiting'; // waiting, active, completed, abandoned
    this.board = data.board || Array(9).fill(null);
    this.currentPlayer = data.currentPlayer || 'X';
    this.winner = data.winner || null;
    this.moves = data.moves || [];
    this.createdAt = data.createdAt || Date.now();
    this.lastMoveAt = data.lastMoveAt || Date.now();
    this.completedAt = data.completedAt || null;
    this.spectators = data.spectators || [];
    this.gameOptions = data.gameOptions || {};
  }

  // Get the symbol for the current player
  getCurrentPlayerSymbol() {
    return this.currentPlayer;
  }

  // Get the player ID for the current turn
  getCurrentPlayerId() {
    if (this.currentPlayer === 'X') {
      return this.player1Id;
    } else {
      return this.player2Id;
    }
  }

  // Get the opponent's player ID
  getOpponentId(playerId) {
    if (playerId === this.player1Id) {
      return this.player2Id;
    } else if (playerId === this.player2Id) {
      return this.player1Id;
    }
    return null;
  }

  // Get player symbol by player ID
  getPlayerSymbol(playerId) {
    if (playerId === this.player1Id) {
      return 'X';
    } else if (playerId === this.player2Id) {
      return 'O';
    }
    return null;
  }

  // Check if a player is in this game
  isPlayerInGame(playerId) {
    return playerId === this.player1Id || playerId === this.player2Id;
  }

  // Check if a player is spectating this game
  isSpectator(playerId) {
    return this.spectators.includes(playerId);
  }

  // Get all participants (players + spectators)
  getAllParticipants() {
    const participants = [];
    
    if (this.player1Id) participants.push(this.player1Id);
    if (this.player2Id) participants.push(this.player2Id);
    
    this.spectators.forEach(spectatorId => {
      if (!participants.includes(spectatorId)) {
        participants.push(spectatorId);
      }
    });
    
    return participants;
  }

  // Get game duration in milliseconds
  getDuration() {
    const endTime = this.completedAt || Date.now();
    return endTime - this.createdAt;
  }

  // Get time since last move
  getTimeSinceLastMove() {
    return Date.now() - this.lastMoveAt;
  }

  // Check if the game is active
  isActive() {
    return this.status === 'active';
  }

  // Check if the game is completed
  isCompleted() {
    return this.status === 'completed' || this.status === 'abandoned';
  }

  // Check if the game is waiting for a second player
  isWaiting() {
    return this.status === 'waiting';
  }

  // Get a safe representation for clients (without sensitive data)
  toClientJSON(playerId = null) {
    const clientData = {
      gameId: this.gameId,
      status: this.status,
      board: this.board,
      currentPlayer: this.currentPlayer,
      winner: this.winner,
      createdAt: this.createdAt,
      lastMoveAt: this.lastMoveAt,
      completedAt: this.completedAt,
      moveCount: this.moves.length,
      spectatorCount: this.spectators.length,
      gameOptions: {
        allowSpectators: this.gameOptions.allowSpectators,
        timeLimit: this.gameOptions.timeLimit
      }
    };

    // Include player information based on perspective
    if (playerId) {
      if (this.isPlayerInGame(playerId)) {
        clientData.isPlayer = true;
        clientData.playerSymbol = this.getPlayerSymbol(playerId);
        clientData.opponentId = this.getOpponentId(playerId);
        clientData.isCurrentTurn = this.getCurrentPlayerId() === playerId;
      } else if (this.isSpectator(playerId)) {
        clientData.isSpectator = true;
      }
    }

    // Include player IDs for completed games or if user is a participant
    if (this.isCompleted() || (playerId && (this.isPlayerInGame(playerId) || this.isSpectator(playerId)))) {
      clientData.player1Id = this.player1Id;
      clientData.player2Id = this.player2Id;
    }

    return clientData;
  }

  // Get full JSON representation (for internal use)
  toJSON() {
    return {
      gameId: this.gameId,
      player1Id: this.player1Id,
      player2Id: this.player2Id,
      status: this.status,
      board: this.board,
      currentPlayer: this.currentPlayer,
      winner: this.winner,
      moves: this.moves,
      createdAt: this.createdAt,
      lastMoveAt: this.lastMoveAt,
      completedAt: this.completedAt,
      spectators: this.spectators,
      gameOptions: this.gameOptions
    };
  }

  // Create GameState from JSON
  static fromJSON(data) {
    return new GameState(data);
  }

  // Create GameState from database row
  static fromDatabaseRow(row) {
    return new GameState({
      gameId: row.game_id,
      player1Id: row.player1_id,
      player2Id: row.player2_id,
      status: row.status,
      board: row.game_data ? row.game_data.board : Array(9).fill(null),
      currentPlayer: row.game_data ? row.game_data.currentPlayer : 'X',
      winner: row.winner_id,
      moves: row.game_data ? row.game_data.moves : [],
      createdAt: new Date(row.started_at).getTime(),
      lastMoveAt: new Date(row.last_move_at).getTime(),
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
      spectators: row.game_data ? row.game_data.spectators : [],
      gameOptions: row.game_data ? row.game_data.gameOptions : {}
    });
  }

  // Convert to database format
  toDatabaseFormat() {
    return {
      game_id: this.gameId,
      player1_id: this.player1Id,
      player2_id: this.player2Id,
      status: this.status,
      winner_id: this.winner,
      game_data: {
        board: this.board,
        currentPlayer: this.currentPlayer,
        moves: this.moves,
        spectators: this.spectators,
        gameOptions: this.gameOptions
      },
      started_at: new Date(this.createdAt),
      last_move_at: new Date(this.lastMoveAt),
      completed_at: this.completedAt ? new Date(this.completedAt) : null
    };
  }

  // Create a move summary for the last move
  getLastMoveInfo() {
    if (this.moves.length === 0) {
      return null;
    }

    const lastMove = this.moves[this.moves.length - 1];
    return {
      playerId: lastMove.playerId,
      position: lastMove.position,
      symbol: lastMove.symbol,
      timestamp: lastMove.timestamp,
      moveNumber: lastMove.moveNumber
    };
  }

  // Get move history for a specific player
  getPlayerMoves(playerId) {
    return this.moves.filter(move => move.playerId === playerId);
  }

  // Clone the game state
  clone() {
    return new GameState(this.toJSON());
  }

  // Validate the game state integrity
  validate() {
    const errors = [];

    if (!this.gameId) {
      errors.push('Game ID is required');
    }

    if (!this.player1Id) {
      errors.push('Player 1 ID is required');
    }

    if (!Array.isArray(this.board) || this.board.length !== 9) {
      errors.push('Board must be an array of 9 elements');
    }

    if (!['X', 'O'].includes(this.currentPlayer)) {
      errors.push('Current player must be X or O');
    }

    if (!['waiting', 'active', 'completed', 'abandoned'].includes(this.status)) {
      errors.push('Invalid game status');
    }

    if (this.status === 'active' && !this.player2Id) {
      errors.push('Active game must have two players');
    }

    if (this.winner && !this.isPlayerInGame(this.winner) && this.winner !== 'draw') {
      errors.push('Winner must be a player in the game or draw');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = GameState;