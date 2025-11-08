import React, { useState, useEffect } from 'react';
import Leaderboard from '../components/Leaderboard/Leaderboard';
import './LeaderboardPage.css';

const LeaderboardPage = () => {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('global');

  useEffect(() => {
    // Simulate API call - replace with actual API call
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        // Mock data for demonstration
        const mockRankings = [
          {
            rank: 1,
            userId: 'user1',
            username: 'ProGamer123',
            displayName: 'Pro Gamer',
            avatarUrl: null,
            gamesPlayed: 150,
            gamesWon: 120,
            gamesLost: 25,
            gamesDrawn: 5,
            winPercentage: 80.0,
            currentStreak: 8,
            bestStreak: 15
          },
          {
            rank: 2,
            userId: 'user2',
            username: 'TicTacMaster',
            displayName: 'Tic Tac Master',
            avatarUrl: null,
            gamesPlayed: 200,
            gamesWon: 155,
            gamesLost: 40,
            gamesDrawn: 5,
            winPercentage: 77.5,
            currentStreak: 5,
            bestStreak: 12
          },
          {
            rank: 3,
            userId: 'user3',
            username: 'GridWarrior',
            displayName: 'Grid Warrior',
            avatarUrl: null,
            gamesPlayed: 180,
            gamesWon: 135,
            gamesLost: 40,
            gamesDrawn: 5,
            winPercentage: 75.0,
            currentStreak: 3,
            bestStreak: 10
          },
          {
            rank: 4,
            userId: 'user4',
            username: 'XOChampion',
            displayName: 'XO Champion',
            avatarUrl: null,
            gamesPlayed: 120,
            gamesWon: 85,
            gamesLost: 30,
            gamesDrawn: 5,
            winPercentage: 70.8,
            currentStreak: 0,
            bestStreak: 8
          },
          {
            rank: 5,
            userId: 'user5',
            username: 'StrategyKing',
            displayName: 'Strategy King',
            avatarUrl: null,
            gamesPlayed: 95,
            gamesWon: 65,
            gamesLost: 25,
            gamesDrawn: 5,
            winPercentage: 68.4,
            currentStreak: 2,
            bestStreak: 7
          }
        ];

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        setRankings(mockRankings);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [selectedRegion]);

  const regions = [
    { value: 'global', label: 'Global' },
    { value: 'europe', label: 'Europe' },
    { value: 'americas', label: 'Americas' },
    { value: 'asia', label: 'Asia' },
    { value: 'oceania', label: 'Oceania' }
  ];

  return (
    <div className="leaderboard-page">
      <div className="container">
        <div className="page-header">
          <h1>Leaderboard</h1>
          <p className="page-subtitle">Compete with the best players worldwide</p>
        </div>

        <div className="region-selector">
          {regions.map(region => (
            <button
              key={region.value}
              className={selectedRegion === region.value ? 'primary' : 'secondary'}
              onClick={() => setSelectedRegion(region.value)}
            >
              {region.label}
            </button>
          ))}
        </div>

        <Leaderboard
          rankings={rankings}
          loading={loading}
          type={selectedRegion}
        />
      </div>
    </div>
  );
};

export default LeaderboardPage;
