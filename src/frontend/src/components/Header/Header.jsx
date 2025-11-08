import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo">
            <h1>TIC-TAC-TOE</h1>
            <span className="logo-subtitle">Global Gaming Platform</span>
          </Link>

          <nav className="nav">
            <Link to="/" className={`nav-link ${isActive('/')}`}>
              Home
            </Link>
            <Link to="/game" className={`nav-link ${isActive('/game')}`}>
              Play
            </Link>
            <Link to="/leaderboard" className={`nav-link ${isActive('/leaderboard')}`}>
              Leaderboard
            </Link>
            <Link to="/support" className={`nav-link ${isActive('/support')}`}>
              Support
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
