// Global Setup for Authentication Service Tests
// Runs once before all test suites

module.exports = async () => {
  console.log('🚀 Starting Authentication Service Test Suite');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Mock AWS credentials
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  process.env.AWS_REGION = 'us-east-1';
  
  // Mock Cognito configuration
  process.env.COGNITO_USER_POOL_ID = 'us-east-1_testpool';
  process.env.COGNITO_CLIENT_ID = 'test-client-id';
  process.env.COGNITO_DOMAIN = 'https://test-domain.auth.us-east-1.amazoncognito.com';
  
  // Set test database configuration
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_NAME = 'test_auth';
  process.env.DB_USER = 'test';
  process.env.DB_PASSWORD = 'test';
  
  // Set test Redis configuration
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  
  // Set test server configuration
  process.env.PORT = '0'; // Use random port for tests
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  
  console.log('✅ Global test setup completed');
};