#!/bin/bash

# Smoke Tests for Post-Deployment Verification
# Validates that deployed services are healthy and responding correctly

set -e

# Configuration
SERVICE_URL=${1:-"http://localhost:3000"}
MAX_RETRIES=30
RETRY_DELAY=10

echo "================================"
echo "Running Smoke Tests"
echo "Service URL: $SERVICE_URL"
echo "================================"
echo ""

# Color codes for output
GREEN='\033[0.32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
  local endpoint=$1
  local expected_status=$2
  local description=$3
  
  echo -n "Testing: $description... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL$endpoint" || echo "000")
  
  if [ "$response" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (HTTP $response)"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC} (Expected HTTP $expected_status, got $response)"
    ((TESTS_FAILED++))
    return 1
  fi
}

# Function to wait for service to be ready
wait_for_service() {
  echo "Waiting for service to be ready..."
  
  for i in $(seq 1 $MAX_RETRIES); do
    if curl -s -f "$SERVICE_URL/health" > /dev/null 2>&1; then
      echo -e "${GREEN}Service is ready!${NC}"
      return 0
    fi
    
    echo "Attempt $i/$MAX_RETRIES: Service not ready yet, waiting ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  done
  
  echo -e "${RED}Service failed to become ready after $MAX_RETRIES attempts${NC}"
  return 1
}

# Wait for service
if ! wait_for_service; then
  echo -e "${RED}Smoke tests aborted: Service not available${NC}"
  exit 1
fi

echo ""
echo "Running endpoint tests..."
echo "----------------------------"

# Health check endpoints
test_endpoint "/health" "200" "Health check endpoint"
test_endpoint "/health/ready" "200" "Readiness check endpoint"
test_endpoint "/health/live" "200" "Liveness check endpoint"

# API endpoints (adjust based on your services)
if [[ "$SERVICE_URL" == *"game-engine"* ]]; then
  echo ""
  echo "Testing Game Engine endpoints..."
  test_endpoint "/api/games" "200" "List games endpoint"
  test_endpoint "/api/games/invalid-id" "404" "Invalid game ID handling"
  
elif [[ "$SERVICE_URL" == *"auth-service"* ]]; then
  echo ""
  echo "Testing Auth Service endpoints..."
  test_endpoint "/api/auth/config" "200" "Auth configuration endpoint"
  test_endpoint "/api/auth/oauth/url?provider=google" "200" "OAuth URL generation"
  
elif [[ "$SERVICE_URL" == *"leaderboard-service"* ]]; then
  echo ""
  echo "Testing Leaderboard Service endpoints..."
  test_endpoint "/api/leaderboard/global" "200" "Global leaderboard endpoint"
  test_endpoint "/api/leaderboard/stats" "200" "Leaderboard statistics"
  
elif [[ "$SERVICE_URL" == *"frontend"* ]]; then
  echo ""
  echo "Testing Frontend endpoints..."
  test_endpoint "/" "200" "Homepage"
  test_endpoint "/game" "200" "Game page"
  test_endpoint "/leaderboard" "200" "Leaderboard page"
fi

# WebSocket connection test (if applicable)
if command -v wscat &> /dev/null; then
  echo ""
  echo "Testing WebSocket connection..."
  timeout 5 wscat -c "${SERVICE_URL/http/ws}/ws" -x '{"type":"ping"}' > /dev/null 2>&1 && \
    echo -e "${GREEN}✓ WebSocket connection successful${NC}" || \
    echo -e "${YELLOW}⚠ WebSocket test skipped or failed${NC}"
fi

# Performance test
echo ""
echo "Testing response time..."
response_time=$(curl -o /dev/null -s -w '%{time_total}' "$SERVICE_URL/health")
response_time_ms=$(echo "$response_time * 1000" | bc)

if (( $(echo "$response_time < 1.0" | bc -l) )); then
  echo -e "${GREEN}✓ Response time: ${response_time_ms}ms (< 1000ms)${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠ Response time: ${response_time_ms}ms (> 1000ms)${NC}"
fi

# Summary
echo ""
echo "================================"
echo "Smoke Test Summary"
echo "================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All smoke tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some smoke tests failed${NC}"
  exit 1
fi
