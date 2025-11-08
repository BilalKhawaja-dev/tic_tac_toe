// Global Setup for Jest Tests
// Runs once before all test suites

module.exports = async () => {
  console.log('🚀 Starting Game Engine Test Suite');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  
  // Mock AWS SDK to prevent actual AWS calls during tests
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  process.env.AWS_REGION = 'us-east-1';
  
  // Set test database configuration
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_NAME = 'test_gameengine';
  process.env.DB_USER = 'test';
  process.env.DB_PASSWORD = 'test';
  
  // Set test Redis configuration
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  
  // Set test DynamoDB configuration
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
  process.env.DYNAMODB_GAMES_TABLE = 'test-games';
  process.env.DYNAMODB_MOVES_TABLE = 'test-moves';
  process.env.DYNAMODB_LEADERBOARD_TABLE = 'test-leaderboard';
  process.env.DYNAMODB_SESSIONS_TABLE = 'test-sessions';
  
  // Set test WebSocket configuration
  process.env.WS_PORT = '0'; // Use random port for tests
  
  console.log('✅ Global test setup completed');
};