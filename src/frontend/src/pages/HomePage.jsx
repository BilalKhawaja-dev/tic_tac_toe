import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  return (
    <div className="home-page">
      <div className="container">
        <div className="hero-section">
          <h1 className="hero-title glow">Welcome to Global Gaming Platform</h1>
          <p className="hero-subtitle">
            Challenge players worldwide in the classic game of Tic-Tac-Toe
          </p>
          <div className="hero-actions">
            <Link to="/game" className="cta-button primary">
              Start Playing
            </Link>
            <Link to="/leaderboard" className="cta-button secondary">
              View Leaderboard
            </Link>
          </div>
        </div>

        <div className="features-section">
          <h2>Features</h2>
          <div className="features-grid">
            <div className="feature-card card">
              <h3>Real-Time Gameplay</h3>
              <p>Experience instant moves with WebSocket technology</p>
            </div>
            <div className="feature-card card">
              <h3>Global Leaderboard</h3>
              <p>Compete with players from around the world</p>
            </div>
            <div className="feature-card card">
              <h3>Social Login</h3>
              <p>Sign in with Google, Facebook, or Twitter</p>
            </div>
            <div className="feature-card card">
              <h3>24/7 Support</h3>
              <p>Get help whenever you need it</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
