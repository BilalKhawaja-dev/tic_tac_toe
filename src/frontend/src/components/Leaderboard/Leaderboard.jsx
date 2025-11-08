import React from 'react';
import './Leaderboard.css';

/**
 * Leaderboard Component
 * Displays player rankings with real-time updates
 */
const Leaderboard = ({ rankings, loading = false, type = 'global' }) => {
  if (loading) {
    return (
      <div className="leaderboard loading">
        <div className="spinner"></div>
        <p>Loading leaderboard...</p>
      </div>
    );
  }

  if (!rankings || rankings.length === 0) {
    return (
      <div className="leaderboard empty">
        <p>No rankings available yet</p>
      </div>
    );
  }

  const getRankClass = (rank) => {
    if (rank === 1) return 'rank-gold';
    if (rank === 2) return 'rank-silver';
    if (rank === 3) return 'rank-bronze';
    return '';
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h3>{type === 'global' ? 'Global' : 'Regional'} Leaderboard</h3>
        <p className="leaderboard-subtitle">Top players worldwide</p>
      </div>

      <div className="leaderboard-table">
        <div className="table-header">
          <div className="col-rank">Rank</div>
          <div className="col-player">Player</div>
          <div className="col-games">Games</div>
          <div className="col-wins">Wins</div>
          <div className="col-winrate">Win Rate</div>
          <div className="col-streak">Streak</div>
        </div>

        <div className="table-body">
          {rankings.map((player, index) => (
            <div
              key={player.userId || index}
              className={`table-row ${getRankClass(player.rank)} fade-in`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="col-rank">
                <span className="rank-badge">
                  {getRankIcon(player.rank)}
                </span>
              </div>
              <div className="col-player">
                <div className="player-info">
                  {player.avatarUrl && (
                    <img
                      src={player.avatarUrl}
                      alt={player.username}
                      className="player-avatar"
                    />
                  )}
                  <div className="player-details">
                    <div className="player-name">{player.displayName || player.username}</div>
                    <div className="player-username">@{player.username}</div>
                  </div>
                </div>
              </div>
              <div className="col-games">{player.gamesPlayed}</div>
              <div className="col-wins">{player.gamesWon}</div>
              <div className="col-winrate">
                <span className="winrate-badge">
                  {player.winPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="col-streak">
                {player.currentStreak > 0 && (
                  <span className="streak-badge">
                    🔥 {player.currentStreak}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
