#!/bin/bash

# Test the fixed routing for leaderboard and game engine services

set -e

echo "Starting test containers..."

# Start leaderboard service (needs DB and Redis, so we'll just test the build)
echo "Testing leaderboard service routes..."
docker run --rm -d --name leaderboard-test \
  -p 3002:3002 \
  -e NODE_ENV=development \
  -e DB_HOST=localhost \
  -e DB_PORT=5432 \
  -e DB_NAME=gamedb \
  -e DB_USER=test \
  -e DB_PASSWORD=test \
  -e REDIS_HOST=localhost \
  -e REDIS_PORT=6379 \
  leaderboard-service:fixed || true

# Start game engine
echo "Testing game engine routes..."
docker run --rm -d --name game-engine-test \
  -p 3000:3000 \
  -e NODE_ENV=development \
  -e PORT=3000 \
  game-engine:fixed || true

# Wait for services to start
echo "Waiting for services to start..."
sleep 5

# Test game engine
echo ""
echo "=== Game Engine Tests ==="
echo "Testing /health:"
curl -s http://localhost:3000/health | jq -r '.status // "FAIL"'

echo "Testing /api/game/health:"
curl -s http://localhost:3000/api/game/health | jq -r '.status // "FAIL"'

echo "Testing /api/game/status:"
curl -s http://localhost:3000/api/game/status | jq -r '.status // "FAIL"'

# Test leaderboard (will fail due to DB connection, but we can see if routes are registered)
echo ""
echo "=== Leaderboard Service Tests ==="
echo "Testing / (root):"
curl -s http://localhost:3002/ | jq -r '.service // "FAIL"'

echo "Testing /api/leaderboard/health (will fail without DB):"
curl -s http://localhost:3002/api/leaderboard/health || echo "Expected to fail without DB"

# Cleanup
echo ""
echo "Cleaning up..."
docker stop leaderboard-test game-engine-test 2>/dev/null || true

echo "Done!"
