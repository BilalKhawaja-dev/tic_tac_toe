#!/bin/bash
# Quick fix script - run after refreshing AWS credentials
set -e

REGION=eu-west-2
ACCOUNT_ID=981686514879
REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform/game-engine"
TAG="fix-$(date +%Y%m%d-%H%M%S)"

echo "=== Quick Game Engine Fix ==="
echo "1. Login to ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REPO}

echo ""
echo "2. Build image..."
docker build -t game-engine:${TAG} src/game-engine/

echo ""
echo "3. Tag for ECR..."
docker tag game-engine:${TAG} ${REPO}:${TAG}
docker tag game-engine:${TAG} ${REPO}:latest

echo ""
echo "4. Push to ECR..."
docker push ${REPO}:${TAG}
docker push ${REPO}:latest

echo ""
echo "5. Force ECS update..."
CLUSTER=$(aws ecs list-clusters --region ${REGION} --query 'clusterArns[0]' --output text | awk -F'/' '{print $NF}')
SERVICE=$(aws ecs list-services --region ${REGION} --cluster ${CLUSTER} --query 'serviceArns[?contains(@, `game-engine`)]' --output text | awk -F'/' '{print $NF}')

aws ecs update-service \
  --region ${REGION} \
  --cluster ${CLUSTER} \
  --service ${SERVICE} \
  --force-new-deployment

echo ""
echo "=== Done! ==="
echo "Monitor logs: aws logs tail /ecs/game-engine --region ${REGION} --follow"
