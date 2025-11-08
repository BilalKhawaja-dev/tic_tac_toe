// Global Teardown for Jest Tests
// Runs once after all test suites complete

module.exports = async () => {
  console.log('🧹 Cleaning up after Game Engine Test Suite');
  
  // Clean up any global resources
  // This could include:
  // - Closing database connections
  // - Stopping test servers
  // - Cleaning up temporary files
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  console.log('✅ Global test teardown completed');
};