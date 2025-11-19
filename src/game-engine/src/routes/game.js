// Game routes - stub implementation
const express = require('express');

module.exports = (gameEngine) => {
  const router = express.Router();

  router.get('/games', (req, res) => {
    res.json({ games: [], message: 'Game routes not yet implemented' });
  });

  router.post('/games', (req, res) => {
    res.status(501).json({ error: 'Not implemented yet' });
  });

  router.get('/status', (req, res) => {
    res.json({ 
      status: 'ok',
      activeGames: gameEngine ? gameEngine.getActiveGameCount() : 0
    });
  });

  return router;
};
