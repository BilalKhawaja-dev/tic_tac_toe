// Game Logic Validator for Tic-Tac-Toe
class GameValidator {
  constructor() {
    // Winning combinations for tic-tac-toe
    this.winningCombinations = [
      [0, 1, 2], // Top row
      [3, 4, 5], // Middle row
      [6, 7, 8], // Bottom row
      [0, 3, 6], // Left column
      [1, 4, 7], // Middle column
      [2, 5, 8], // Right column
      [0, 4, 8], // Diagonal top-left to bottom-right
      [2, 4, 6]  // Diagonal top-right to bottom-left
    ];
  }

  // Validate a move attempt
  validateMove(gameState, playerId, position) {
    // Check if game exists and is active
    if (!gameState) {
      return { valid: false, error: 'Game not found' };
    }

    if (gameState.status !== 'active') {
      return { valid: false, error: 'Game is not active' };
    }

    // Check if it's the player's turn
    if (gameState.getCurrentPlayerId() !== playerId) {
      return { valid: false, error: 'Not your turn' };
    }

    // Validate position
    if (!this.isValidPosition(position)) {
      return { valid: false, error: 'Invalid position' };
    }

    // Check if position is already occupied
    if (gameState.board[position] !== null) {
      return { valid: false, error: 'Position already occupied' };
    }

    return { valid: true };
  }

  // Check if position is valid (0-8)
  isValidPosition(position) {
    return Number.isInteger(position) && position >= 0 && position <= 8;
  }

  // Check if the game has ended (win or draw)
  checkGameEnd(board) {
    // Check for winner
    const winner = this.checkWinner(board);
    if (winner) {
      return {
        isGameOver: true,
        winner: winner,
        winningCombination: this.getWinningCombination(board)
      };
    }

    // Check for draw (board full)
    if (this.isBoardFull(board)) {
      return {
        isGameOver: true,
        winner: null, // Draw
        winningCombination: null
      };
    }

    return {
      isGameOver: false,
      winner: null,
      winningCombination: null
    };
  }

  // Check for a winner
  checkWinner(board) {
    for (const combination of this.winningCombinations) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a]; // Return 'X' or 'O'
      }
    }
    return null;
  }

  // Get the winning combination if there is one
  getWinningCombination(board) {
    for (const combination of this.winningCombinations) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return combination;
      }
    }
    return null;
  }

  // Check if the board is full
  isBoardFull(board) {
    return board.every(cell => cell !== null);
  }

  // Get available moves
  getAvailableMoves(board) {
    const availableMoves = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i] === null) {
        availableMoves.push(i);
      }
    }
    return availableMoves;
  }

  // Validate game state integrity
  validateGameState(gameState) {
    const errors = [];

    // Check board state
    if (!Array.isArray(gameState.board) || gameState.board.length !== 9) {
      errors.push('Invalid board structure');
      return { valid: false, errors };
    }

    // Count X's and O's
    const xCount = gameState.board.filter(cell => cell === 'X').length;
    const oCount = gameState.board.filter(cell => cell === 'O').length;

    // X should go first, so X count should be equal to O count or one more
    if (xCount < oCount || xCount > oCount + 1) {
      errors.push('Invalid move count - X should go first');
    }

    // Check if current player matches the expected player based on move count
    const expectedCurrentPlayer = (xCount === oCount) ? 'X' : 'O';
    if (gameState.status === 'active' && gameState.currentPlayer !== expectedCurrentPlayer) {
      errors.push('Current player does not match move count');
    }

    // Check for multiple winners (impossible in valid game)
    const winner = this.checkWinner(gameState.board);
    if (winner && gameState.status === 'active') {
      errors.push('Game should be completed if there is a winner');
    }

    // Validate moves history
    if (gameState.moves.length !== xCount + oCount) {
      errors.push('Move history does not match board state');
    }

    // Check if moves are in correct order
    for (let i = 0; i < gameState.moves.length; i++) {
      const move = gameState.moves[i];
      const expectedSymbol = (i % 2 === 0) ? 'X' : 'O';
      
      if (move.symbol !== expectedSymbol) {
        errors.push(`Move ${i + 1} has incorrect symbol`);
      }

      if (!this.isValidPosition(move.position)) {
        errors.push(`Move ${i + 1} has invalid position`);
      }

      if (move.moveNumber !== i + 1) {
        errors.push(`Move ${i + 1} has incorrect move number`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Simulate a move to check the result
  simulateMove(board, position, symbol) {
    if (!this.isValidPosition(position) || board[position] !== null) {
      return null;
    }

    const newBoard = [...board];
    newBoard[position] = symbol;

    return {
      board: newBoard,
      gameEnd: this.checkGameEnd(newBoard)
    };
  }

  // Get game statistics from board
  getBoardStats(board) {
    const xCount = board.filter(cell => cell === 'X').length;
    const oCount = board.filter(cell => cell === 'O').length;
    const emptyCount = board.filter(cell => cell === null).length;

    return {
      xCount,
      oCount,
      emptyCount,
      totalMoves: xCount + oCount,
      availableMoves: this.getAvailableMoves(board)
    };
  }

  // Check if a position would create a winning move
  isWinningMove(board, position, symbol) {
    const simulation = this.simulateMove(board, position, symbol);
    return simulation && simulation.gameEnd.isGameOver && simulation.gameEnd.winner === symbol;
  }

  // Check if a position would block opponent's winning move
  isBlockingMove(board, position, symbol) {
    const opponentSymbol = symbol === 'X' ? 'O' : 'X';
    return this.isWinningMove(board, position, opponentSymbol);
  }

  // Get strategic move suggestions (for AI or hints)
  getStrategicMoves(board, symbol) {
    const availableMoves = this.getAvailableMoves(board);
    const moves = [];

    for (const position of availableMoves) {
      const moveInfo = {
        position,
        priority: 0,
        type: 'normal'
      };

      // Winning move has highest priority
      if (this.isWinningMove(board, position, symbol)) {
        moveInfo.priority = 100;
        moveInfo.type = 'winning';
      }
      // Blocking move has high priority
      else if (this.isBlockingMove(board, position, symbol)) {
        moveInfo.priority = 90;
        moveInfo.type = 'blocking';
      }
      // Center position has medium priority
      else if (position === 4) {
        moveInfo.priority = 50;
        moveInfo.type = 'center';
      }
      // Corner positions have medium-low priority
      else if ([0, 2, 6, 8].includes(position)) {
        moveInfo.priority = 30;
        moveInfo.type = 'corner';
      }
      // Edge positions have low priority
      else {
        moveInfo.priority = 10;
        moveInfo.type = 'edge';
      }

      moves.push(moveInfo);
    }

    // Sort by priority (highest first)
    return moves.sort((a, b) => b.priority - a.priority);
  }

  // Validate game creation parameters
  validateGameCreation(gameOptions = {}) {
    const errors = [];

    if (gameOptions.timeLimit && 
        (typeof gameOptions.timeLimit !== 'number' || 
         gameOptions.timeLimit < 30000 || 
         gameOptions.timeLimit > 600000)) {
      errors.push('Time limit must be between 30 seconds and 10 minutes');
    }

    if (gameOptions.allowSpectators !== undefined && 
        typeof gameOptions.allowSpectators !== 'boolean') {
      errors.push('allowSpectators must be a boolean');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = GameValidator;