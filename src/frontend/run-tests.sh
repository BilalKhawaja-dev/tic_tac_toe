#!/bin/bash

# Frontend Test Runner Script
# Runs all frontend tests with coverage

echo "================================"
echo "Running Frontend Tests"
echo "================================"
echo ""

# Navigate to frontend directory
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
  echo ""
fi

# Run tests
echo "Running unit and integration tests..."
npm test -- --coverage --verbose

# Check test results
if [ $? -eq 0 ]; then
  echo ""
  echo "================================"
  echo "✅ All frontend tests passed!"
  echo "================================"
  exit 0
else
  echo ""
  echo "================================"
  echo "❌ Some frontend tests failed"
  echo "================================"
  exit 1
fi
