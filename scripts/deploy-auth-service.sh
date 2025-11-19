#!/bin/bash
# Deploy auth-service
set -e

REGION=eu-west-2
ACCOUNT_ID=981686514879
REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform/auth-service"
TAG="deploy-$(date +%Y%m%d-%H%M%S)"

echo "=== Deploying Auth Service ==="

aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REPO}

docker build -t auth-service:${TAG} -t auth-service:latest src/auth-service/
docker tag auth-service:${TAG} ${REPO}:${TAG}
docker tag auth-service:latest ${REPO}:latest
docker push ${REPO}:${TAG}
docker push ${REPO}:latest

aws ecs update-service \
  --region ${REGION} \
  --cluster global-gaming-platform-cluster \
  --service global-gaming-platform-auth-service \
  --force-new-deployment \
  --no-cli-pager

echo "✅ Auth service deployed: ${REPO}:${TAG}"
