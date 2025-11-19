#!/bin/bash

# Quick redeploy script for game-engine after code fixes
set -e

echo "=== Game Engine Redeployment Script ==="
echo "Timestamp: $(date)"
echo ""

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-eu-west-2}
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/global-gaming-platform/game-engine"
IMAGE_TAG="latest-$(date +%Y%m%d-%H%M%S)"

echo "AWS Account: ${AWS_ACCOUNT_ID}"
echo "Region: ${AWS_REGION}"
echo "ECR Repository: ${ECR_REPO}"
echo "Image Tag: ${IMAGE_TAG}"
echo ""

# Login to ECR
echo "Step 1: Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO}

# Build Docker image
echo ""
echo "Step 2: Building Docker image..."
cd src/game-engine
docker build -t game-engine:${IMAGE_TAG} -t game-engine:latest .

# Tag for ECR
echo ""
echo "Step 3: Tagging image for ECR..."
docker tag game-engine:${IMAGE_TAG} ${ECR_REPO}:${IMAGE_TAG}
docker tag game-engine:latest ${ECR_REPO}:latest

# Push to ECR
echo ""
echo "Step 4: Pushing to ECR..."
docker push ${ECR_REPO}:${IMAGE_TAG}
docker push ${ECR_REPO}:latest

# Force new deployment
echo ""
echo "Step 5: Forcing ECS service update..."
cd ../..
CLUSTER_NAME=$(aws ecs list-clusters --query 'clusterArns[0]' --output text | awk -F'/' '{print $NF}')
SERVICE_NAME=$(aws ecs list-services --cluster ${CLUSTER_NAME} --query 'serviceArns[?contains(@, `game-engine`)]' --output text | awk -F'/' '{print $NF}')

if [ -z "$SERVICE_NAME" ]; then
  echo "ERROR: Could not find game-engine service"
  exit 1
fi

echo "Cluster: ${CLUSTER_NAME}"
echo "Service: ${SERVICE_NAME}"

aws ecs update-service \
  --cluster ${CLUSTER_NAME} \
  --service ${SERVICE_NAME} \
  --force-new-deployment \
  --query 'service.{serviceName:serviceName,status:status,desiredCount:desiredCount,runningCount:runningCount}' \
  --output table

echo ""
echo "Step 6: Waiting for deployment to stabilize..."
aws ecs wait services-stable \
  --cluster ${CLUSTER_NAME} \
  --services ${SERVICE_NAME}

echo ""
echo "=== Deployment Complete ==="
echo "Image: ${ECR_REPO}:${IMAGE_TAG}"
echo ""
echo "Check service status:"
echo "  aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME}"
echo ""
echo "View logs:"
echo "  aws logs tail /ecs/game-engine --follow"
