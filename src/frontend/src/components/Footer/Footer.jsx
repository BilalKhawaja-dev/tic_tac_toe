import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Global Gaming Platform</h3>
            <p>Play tic-tac-toe with players around the world</p>
          </div>

          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li><a href="/">Home</a></li>
              <li><a href="/game">Play Game</a></li>
              <li><a href="/leaderboard">Leaderboard</a></li>
              <li><a href="/support">Support</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Connect</h4>
            <p>Follow us for updates and tournaments</p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {currentYear} Global Gaming Platform. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
