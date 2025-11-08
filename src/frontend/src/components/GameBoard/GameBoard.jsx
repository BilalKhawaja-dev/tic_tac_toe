import React from 'react';
import './GameBoard.css';

/**
 * GameBoard Component
 * Renders a 3x3 tic-tac-toe game board with click handlers and animations
 */
const GameBoard = ({ 
  board, 
  onCellClick, 
  currentPlayer, 
  winner, 
  winningLine,
  disabled 
}) => {
  const handleCellClick = (row, col) => {
    if (disabled || board[row][col] !== null || winner) {
      return;
    }
    onCellClick(row, col);
  };

  const getCellClassName = (row, col) => {
    const classes = ['game-cell'];
    
    if (board[row][col]) {
      classes.push('filled');
      classes.push(board[row][col] === 'X' ? 'player-x' : 'player-o');
    }
    
    if (winningLine && isWinningCell(row, col, winningLine)) {
      classes.push('winning-cell');
    }
    
    if (!disabled && !board[row][col] && !winner) {
      classes.push('clickable');
    }
    
    return classes.join(' ');
  };

  const isWinningCell = (row, col, winningLine) => {
    if (!winningLine) return false;
    return winningLine.some(([r, c]) => r === row && c === col);
  };

  return (
    <div className="game-board-container">
      <div className="game-board">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="game-row">
            {row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={getCellClassName(rowIndex, colIndex)}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                role="button"
                tabIndex={0}
                aria-label={`Cell ${rowIndex}-${colIndex}, ${cell || 'empty'}`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleCellClick(rowIndex, colIndex);
                  }
                }}
              >
                <span className="cell-content">
                  {cell}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {currentPlayer && !winner && (
        <div className="current-player-indicator">
          <span className="pulse">Current Player: </span>
          <span className={`player-marker ${currentPlayer === 'X' ? 'player-x' : 'player-o'}`}>
            {currentPlayer}
          </span>
        </div>
      )}
      
      {winner && (
        <div className="game-result fade-in">
          {winner === 'draw' ? (
            <h3 className="text-warning">It's a Draw!</h3>
          ) : (
            <h3 className="text-success glow">
              Player {winner} Wins!
            </h3>
          )}
        </div>
      )}
    </div>
  );
};

export default GameBoard;
