#!/bin/bash

# Deploy routing fixes for game engine and leaderboard services
# This script rebuilds and redeploys both services with fixed route mounting

set -e

echo "========================================="
echo "Deploying Routing Fixes"
echo "========================================="
echo ""

# Configuration
REGION="eu-west-2"
ACCOUNT_ID="981686514879"
CLUSTER="global-gaming-platform-cluster"

# ECR repositories
GAME_ENGINE_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform/game-engine"
LEADERBOARD_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform-leaderboard-service"

echo "Step 1: Login to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

echo ""
echo "Step 2: Build game engine image..."
docker build -t game-engine:latest src/game-engine
docker tag game-engine:latest ${GAME_ENGINE_REPO}:latest
docker tag game-engine:latest ${GAME_ENGINE_REPO}:routing-fix-$(date +%Y%m%d-%H%M%S)

echo ""
echo "Step 3: Build leaderboard service image..."
docker build -t leaderboard-service:latest src/leaderboard-service
docker tag leaderboard-service:latest ${LEADERBOARD_REPO}:latest
docker tag leaderboard-service:latest ${LEADERBOARD_REPO}:routing-fix-$(date +%Y%m%d-%H%M%S)

echo ""
echo "Step 4: Push game engine image..."
docker push ${GAME_ENGINE_REPO}:latest
docker push ${GAME_ENGINE_REPO}:routing-fix-$(date +%Y%m%d-%H%M%S)

echo ""
echo "Step 5: Push leaderboard service image..."
docker push ${LEADERBOARD_REPO}:latest
docker push ${LEADERBOARD_REPO}:routing-fix-$(date +%Y%m%d-%H%M%S)

echo ""
echo "Step 6: Force new deployment of game engine..."
aws ecs update-service \
  --cluster $CLUSTER \
  --service global-gaming-platform-game-engine \
  --force-new-deployment \
  --region $REGION

echo ""
echo "Step 7: Force new deployment of leaderboard service..."
aws ecs update-service \
  --cluster $CLUSTER \
  --service global-gaming-platform-leaderboard-service \
  --force-new-deployment \
  --region $REGION

echo ""
echo "Step 8: Wait for services to stabilize..."
echo "Waiting for game engine..."
aws ecs wait services-stable \
  --cluster $CLUSTER \
  --services global-gaming-platform-game-engine \
  --region $REGION

echo "Waiting for leaderboard service..."
aws ecs wait services-stable \
  --cluster $CLUSTER \
  --services global-gaming-platform-leaderboard-service \
  --region $REGION

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Testing endpoints..."
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --region $REGION \
  --query 'LoadBalancers[?contains(LoadBalancerName, `gaming`)].DNSName' \
  --output text)

echo "ALB DNS: $ALB_DNS"
echo ""
echo "Game Engine Health: $(curl -s -o /dev/null -w '%{http_code}' http://$ALB_DNS/api/game/health)"
echo "Leaderboard Health: $(curl -s -o /dev/null -w '%{http_code}' http://$ALB_DNS/api/leaderboard/health)"
echo "Leaderboard Global: $(curl -s -o /dev/null -w '%{http_code}' http://$ALB_DNS/api/leaderboard/global)"
echo ""
echo "All done!"
