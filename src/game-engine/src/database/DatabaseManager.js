// Stub DatabaseManager - minimal implementation
const logger = require('../utils/logger');

class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.connected = false;
  }

  async initialize() {
    logger.info('DatabaseManager: Initializing (stub implementation)');
    this.connected = true;
    return Promise.resolve();
  }

  async connect() {
    logger.info('DatabaseManager: Skipping database connection (stub)');
    this.connected = true;
    return Promise.resolve();
  }

  async close() {
    logger.info('DatabaseManager: Closing connection (stub)');
    this.connected = false;
    return Promise.resolve();
  }

  async disconnect() {
    this.connected = false;
    return Promise.resolve();
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = DatabaseManager;
