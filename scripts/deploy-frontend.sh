#!/bin/bash
# Deploy frontend
set -e

REGION=eu-west-2
ACCOUNT_ID=981686514879
REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform/frontend"
TAG="deploy-$(date +%Y%m%d-%H%M%S)"

echo "=== Deploying Frontend ==="

aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REPO}

docker build -t frontend:${TAG} -t frontend:latest src/frontend/
docker tag frontend:${TAG} ${REPO}:${TAG}
docker tag frontend:latest ${REPO}:latest
docker push ${REPO}:${TAG}
docker push ${REPO}:latest

aws ecs update-service \
  --region ${REGION} \
  --cluster global-gaming-platform-cluster \
  --service global-gaming-platform-frontend \
  --force-new-deployment \
  --no-cli-pager

echo "✅ Frontend deployed: ${REPO}:${TAG}"
