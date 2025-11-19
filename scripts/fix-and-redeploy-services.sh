#!/bin/bash

# Fix and Redeploy Services Script
# Rebuilds and redeploys auth-service and leaderboard-service with fixes

set -e

echo "=========================================="
echo "Fixing and Redeploying Services"
echo "=========================================="

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-eu-west-2}
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "AWS Account: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo "ECR Registry: $ECR_REGISTRY"

# Login to ECR
echo ""
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push auth-service
echo ""
echo "=========================================="
echo "Building auth-service..."
echo "=========================================="
cd src/auth-service
docker build -t global-gaming-platform-auth-service:latest .
docker tag global-gaming-platform-auth-service:latest $ECR_REGISTRY/global-gaming-platform/auth-service:latest
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
docker tag global-gaming-platform-leaderboard-service:latest $ECR_REGISTRY/global-gaming-platform/leaderboard-service:latest
echo "Pushing leaderboard-service to ECR..."
docker push $ECR_REGISTRY/global-gaming-platform/leaderboard-service:latest
cd ../..

# Force new deployment for auth-service
echo ""
echo "=========================================="
echo "Forcing new deployment for auth-service..."
echo "=========================================="
aws ecs update-service \
  --cluster global-gaming-platform-cluster \
  --service global-gaming-platform-auth-service \
  --force-new-deployment \
  --region $AWS_REGION

# Force new deployment for leaderboard-service
echo ""
echo "=========================================="
echo "Forcing new deployment for leaderboard-service..."
echo "=========================================="
aws ecs update-service \
  --cluster global-gaming-platform-cluster \
  --service global-gaming-platform-leaderboard-service \
  --force-new-deployment \
  --region $AWS_REGION

echo ""
echo "=========================================="
echo "Waiting for services to stabilize..."
echo "=========================================="

# Wait for auth-service
echo "Waiting for auth-service..."
aws ecs wait services-stable \
  --cluster global-gaming-platform-cluster \
  --services global-gaming-platform-auth-service \
  --region $AWS_REGION

# Wait for leaderboard-service
echo "Waiting for leaderboard-service..."
aws ecs wait services-stable \
  --cluster global-gaming-platform-cluster \
  --services global-gaming-platform-leaderboard-service \
  --region $AWS_REGION

echo ""
echo "=========================================="
echo "Checking service status..."
echo "=========================================="

# Check auth-service
echo ""
echo "Auth Service Status:"
aws ecs describe-services \
  --cluster global-gaming-platform-cluster \
  --services global-gaming-platform-auth-service \
  --region $AWS_REGION \
  --query 'services[0].[serviceName,status,runningCount,desiredCount,deployments[0].status]' \
  --output table

# Check leaderboard-service
echo ""
echo "Leaderboard Service Status:"
aws ecs describe-services \
  --cluster global-gaming-platform-cluster \
  --services global-gaming-platform-leaderboard-service \
  --region $AWS_REGION \
  --query 'services[0].[serviceName,status,runningCount,desiredCount,deployments[0].status]' \
  --output table

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Services have been rebuilt and redeployed with fixes:"
echo "  ✓ auth-service: Added missing validation middleware"
echo "  ✓ leaderboard-service: Fixed database password configuration"
echo ""
echo "Check CloudWatch logs to verify services are running correctly."
