import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import GameBoard from '../components/GameBoard/GameBoard';
import PlayerStats from '../components/PlayerStats/PlayerStats';
import WebSocketStatus from '../components/WebSocketStatus/WebSocketStatus';
import useWebSocket from '../hooks/useWebSocket';
import ApiService from '../services/ApiService';
import './GamePage.css';

const GamePage = () => {
  const { gameId } = useParams();
  const [board, setBoard] = useState([
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ]);
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [winner, setWinner] = useState(null);
  const [winningLine, setWinningLine] = useState(null);
  const [gameStatus, setGameStatus] = useState('active');
  const [playerStats, setPlayerStats] = useState({
    gamesPlayed: 10,
    gamesWon: 6,
    gamesLost: 3,
    gamesDrawn: 1,
    currentStreak: 2,
    bestStreak: 4,
    winPercentage: 60.0
  });

  // WebSocket connection for real-time updates
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
  const { 
    status: wsStatus, 
    isConnected, 
    sendMessage, 
    subscribe, 
    reconnect 
  } = useWebSocket(wsUrl);

  // Subscribe to game updates
  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to game state updates
    const unsubscribeGameState = subscribe('game_state', (payload) => {
      if (payload.gameId === gameId) {
        setBoard(payload.board);
        setCurrentPlayer(payload.currentPlayer);
        if (payload.winner) {
          setWinner(payload.winner);
          setWinningLine(payload.winningLine);
          setGameStatus('completed');
        }
      }
    });

    // Subscribe to move updates
    const unsubscribeMove = subscribe('move', (payload) => {
      if (payload.gameId === gameId) {
        const { row, col, player } = payload;
        setBoard(prevBoard => {
          const newBoard = prevBoard.map((r, i) =>
            r.map((cell, j) => (i === row && j === col ? player : cell))
          );
          return newBoard;
        });
        setCurrentPlayer(player === 'X' ? 'O' : 'X');
      }
    });

    // Join the game room
    if (gameId) {
      sendMessage('join_game', { gameId });
    }

    return () => {
      unsubscribeGameState();
      unsubscribeMove();
      if (gameId) {
        sendMessage('leave_game', { gameId });
      }
    };
  }, [isConnected, gameId, subscribe, sendMessage]);

  const checkWinner = (gameBoard) => {
    // Check rows
    for (let i = 0; i < 3; i++) {
      if (gameBoard[i][0] && 
          gameBoard[i][0] === gameBoard[i][1] && 
          gameBoard[i][1] === gameBoard[i][2]) {
        return { winner: gameBoard[i][0], line: [[i, 0], [i, 1], [i, 2]] };
      }
    }

    // Check columns
    for (let i = 0; i < 3; i++) {
      if (gameBoard[0][i] && 
          gameBoard[0][i] === gameBoard[1][i] && 
          gameBoard[1][i] === gameBoard[2][i]) {
        return { winner: gameBoard[0][i], line: [[0, i], [1, i], [2, i]] };
      }
    }

    // Check diagonals
    if (gameBoard[0][0] && 
        gameBoard[0][0] === gameBoard[1][1] && 
        gameBoard[1][1] === gameBoard[2][2]) {
      return { winner: gameBoard[0][0], line: [[0, 0], [1, 1], [2, 2]] };
    }

    if (gameBoard[0][2] && 
        gameBoard[0][2] === gameBoard[1][1] && 
        gameBoard[1][1] === gameBoard[2][0]) {
      return { winner: gameBoard[0][2], line: [[0, 2], [1, 1], [2, 0]] };
    }

    // Check for draw
    const isFull = gameBoard.every(row => row.every(cell => cell !== null));
    if (isFull) {
      return { winner: 'draw', line: null };
    }

    return null;
  };

  const handleCellClick = (row, col) => {
    if (board[row][col] || winner) return;

    // Send move via WebSocket if connected
    if (isConnected && gameId) {
      sendMessage('make_move', {
        gameId,
        row,
        col,
        player: currentPlayer
      });
    } else {
      // Fallback to local game logic
      const newBoard = board.map((r, i) =>
        r.map((cell, j) => (i === row && j === col ? currentPlayer : cell))
      );

      setBoard(newBoard);

      const result = checkWinner(newBoard);
      if (result) {
        setWinner(result.winner);
        setWinningLine(result.line);
        setGameStatus('completed');
      } else {
        setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
      }
    }
  };

  const handleNewGame = () => {
    setBoard([
      [null, null, null],
      [null, null, null],
      [null, null, null]
    ]);
    setCurrentPlayer('X');
    setWinner(null);
    setWinningLine(null);
    setGameStatus('active');
  };

  const handleForfeit = () => {
    if (window.confirm('Are you sure you want to forfeit this game?')) {
      setWinner(currentPlayer === 'X' ? 'O' : 'X');
      setGameStatus('forfeited');
    }
  };

  return (
    <div className="game-page">
      <div className="container">
        <div className="game-header">
          <h1>Play Tic-Tac-Toe</h1>
          <p className="game-subtitle">Challenge yourself or play with friends</p>
          <WebSocketStatus status={wsStatus} onReconnect={reconnect} />
        </div>

        <div className="game-controls">
          <button 
            className="primary" 
            onClick={handleNewGame}
          >
            New Game
          </button>
          <button 
            className="danger" 
            onClick={handleForfeit}
            disabled={gameStatus !== 'active'}
          >
            Forfeit
          </button>
          <button 
            className="secondary"
            onClick={() => window.location.href = '/leaderboard'}
          >
            View Leaderboard
          </button>
        </div>

        <GameBoard
          board={board}
          onCellClick={handleCellClick}
          currentPlayer={currentPlayer}
          winner={winner}
          winningLine={winningLine}
          disabled={gameStatus !== 'active'}
        />

        {gameStatus === 'forfeited' && (
          <div className="game-message fade-in">
            <p className="text-warning">Game forfeited. Player {winner} wins by default.</p>
          </div>
        )}

        <PlayerStats stats={playerStats} />
      </div>
    </div>
  );
};

export default GamePage;
