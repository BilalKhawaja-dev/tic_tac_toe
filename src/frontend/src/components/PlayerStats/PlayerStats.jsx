import React from 'react';
import './PlayerStats.css';

/**
 * PlayerStats Component
 * Displays player statistics with real-time updates
 */
const PlayerStats = ({ stats, loading = false }) => {
  if (loading) {
    return (
      <div className="player-stats loading">
        <div className="spinner"></div>
        <p>Loading stats...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="player-stats empty">
        <p>No statistics available</p>
      </div>
    );
  }

  const {
    gamesPlayed = 0,
    gamesWon = 0,
    gamesLost = 0,
    gamesDrawn = 0,
    currentStreak = 0,
    bestStreak = 0,
    winPercentage = 0
  } = stats;

  const getStreakClass = (streak) => {
    if (streak >= 5) return 'streak-hot';
    if (streak >= 3) return 'streak-warm';
    return '';
  };

  return (
    <div className="player-stats">
      <h3>Your Statistics</h3>
      
      <div className="stats-grid">
        <div className="stat-card card">
          <div className="stat-icon">🎮</div>
          <div className="stat-value">{gamesPlayed}</div>
          <div className="stat-label">Games Played</div>
        </div>

        <div className="stat-card card success">
          <div className="stat-icon">🏆</div>
          <div className="stat-value">{gamesWon}</div>
          <div className="stat-label">Wins</div>
        </div>

        <div className="stat-card card danger">
          <div className="stat-icon">❌</div>
          <div className="stat-value">{gamesLost}</div>
          <div className="stat-label">Losses</div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">🤝</div>
          <div className="stat-value">{gamesDrawn}</div>
          <div className="stat-label">Draws</div>
        </div>

        <div className="stat-card card highlight">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{winPercentage.toFixed(1)}%</div>
          <div className="stat-label">Win Rate</div>
        </div>

        <div className={`stat-card card ${getStreakClass(currentStreak)}`}>
          <div className="stat-icon">🔥</div>
          <div className="stat-value">{currentStreak}</div>
          <div className="stat-label">Current Streak</div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{bestStreak}</div>
          <div className="stat-label">Best Streak</div>
        </div>
      </div>
    </div>
  );
};

export default PlayerStats;
