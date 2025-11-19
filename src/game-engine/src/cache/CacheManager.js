// Stub CacheManager - minimal implementation
const logger = require('../utils/logger');

class CacheManager {
  constructor(config) {
    this.config = config;
    this.connected = false;
  }

  async initialize() {
    logger.info('CacheManager: Initializing (stub implementation)');
    this.connected = true;
    return Promise.resolve();
  }

  async connect() {
    logger.info('CacheManager: Skipping cache connection (stub)');
    this.connected = true;
    return Promise.resolve();
  }

  async close() {
    logger.info('CacheManager: Closing connection (stub)');
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

module.exports = CacheManager;
