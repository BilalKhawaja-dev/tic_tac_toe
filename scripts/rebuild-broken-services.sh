#!/bin/bash

# Rebuild and Deploy Broken Services
# Fixes auth-service and leaderboard-service issues

set -e

echo "=========================================="
echo "Rebuilding Broken Services"
echo "=========================================="

# Configuration
AWS_REGION=${AWS_REGION:-eu-west-2}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
CLUSTER_NAME="global-gaming-platform-cluster"

echo "AWS Account: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo "ECR Registry: $ECR_REGISTRY"
echo "Cluster: $CLUSTER_NAME"

# Login to ECR
echo ""
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push auth-service
echo ""
echo "=========================================="
echo "Building auth-service..."
echo "=========================================="
cd src/auth-service
docker build -t global-gaming-platform-auth-service:latest .
docker tag global-gaming-platform-auth-service:latest \
  $ECR_REGISTRY/global-gaming-platform/auth-service:latest
echo "Pushing auth-service to ECR..."
docker push $ECR_REGISTRY/global-gaming-platform/auth-service:latest
cd ../..

# Build and push leaderboard-service
echo ""
echo "=========================================="
echo "Building leaderboard-service..."
echo "=========================================="
cd src/leaderboard-service
docker build -t global-gaming-platform-leaderboard-service:latest .
docker tag global-gaming-platform-leaderboard-service:latest \
  $ECR_REGISTRY/global-gaming-platform/leaderboard-service:latest
echo "Pushing leaderboard-service to ECR..."
docker push $ECR_REGISTRY/global-gaming-platform/leaderboard-service:latest
cd ../..

# Force new deployments
echo ""
echo "=========================================="
echo "Forcing new deployments..."
echo "=========================================="

echo "Updating auth-service..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service global-gaming-platform-auth-service \
  --force-new-deployment \
  --region $AWS_REGION

echo "Updating leaderboard-service..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service global-gaming-platform-leaderboard-service \
  --force-new-deployment \
  --region $AWS_REGION

echo ""
echo "=========================================="
echo "Waiting for services to stabilize..."
echo "=========================================="
echo "This may take 5-10 minutes..."

# Wait for auth-service
echo ""
echo "Waiting for auth-service..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services global-gaming-platform-auth-service \
  --region $AWS_REGION &
AUTH_PID=$!

# Wait for leaderboard-service
echo "Waiting for leaderboard-service..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services global-gaming-platform-leaderboard-service \
  --region $AWS_REGION &
LEADERBOARD_PID=$!

# Wait for both
wait $AUTH_PID
echo "✓ Auth service is stable"
wait $LEADERBOARD_PID
echo "✓ Leaderboard service is stable"

# Check service status
echo ""
echo "=========================================="
echo "Service Status"
echo "=========================================="

aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services global-gaming-platform-auth-service global-gaming-platform-leaderboard-service \
  --region $AWS_REGION \
  --query 'services[*].[serviceName,status,runningCount,desiredCount,deployments[0].rolloutState]' \
  --output table

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Check CloudWatch logs to verify services are running:"
echo "  aws logs tail /ecs/global-gaming-platform-auth-service --follow --region $AWS_REGION"
echo "  aws logs tail /ecs/global-gaming-platform-leaderboard-service --follow --region $AWS_REGION"
