#!/bin/bash
# Deploy leaderboard-service
set -e

REGION=eu-west-2
ACCOUNT_ID=981686514879
REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform/leaderboard-service"
TAG="deploy-$(date +%Y%m%d-%H%M%S)"

echo "=== Deploying Leaderboard Service ==="

aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REPO}

docker build -t leaderboard-service:${TAG} -t leaderboard-service:latest src/leaderboard-service/
docker tag leaderboard-service:${TAG} ${REPO}:${TAG}
docker tag leaderboard-service:latest ${REPO}:latest
docker push ${REPO}:${TAG}
docker push ${REPO}:latest

aws ecs update-service \
  --region ${REGION} \
  --cluster global-gaming-platform-cluster \
  --service global-gaming-platform-leaderboard-service \
  --force-new-deployment \
  --no-cli-pager

echo "✅ Leaderboard service deployed: ${REPO}:${TAG}"
