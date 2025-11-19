#!/bin/bash
# Rebuild and redeploy all three failing services

set -e

AWS_REGION=eu-west-2
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CLUSTER_NAME="global-gaming-platform-cluster"

echo "=========================================="
echo "Rebuilding All Services"
echo "Region: $AWS_REGION"
echo "=========================================="

# Login to ECR
echo ""
echo "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push frontend
echo ""
echo "1/3 Building frontend..."
cd src/frontend
docker build -t frontend:latest .
docker tag frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/frontend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/frontend:latest
echo "✓ Frontend pushed"
cd ../..

# Build and push leaderboard
echo ""
echo "2/3 Building leaderboard-service..."
cd src/leaderboard-service
docker build -t leaderboard:latest .
docker tag leaderboard:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/leaderboard-service:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/leaderboard-service:latest
echo "✓ Leaderboard pushed"
cd ../..

# Build and push auth-service
echo ""
echo "3/3 Building auth-service..."
cd src/auth-service
docker build -t auth:latest .
docker tag auth:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/auth-service:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/auth-service:latest
echo "✓ Auth service pushed"
cd ../..

# Force new deployments
echo ""
echo "Forcing new deployments..."

for service in frontend leaderboard-service auth-service; do
  echo "Updating global-gaming-platform-$service..."
  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service global-gaming-platform-$service \
    --force-new-deployment \
    --region $AWS_REGION \
    --no-cli-pager
done

echo ""
echo "✓ All deployments initiated"
echo ""
echo "Monitor with:"
echo "aws logs tail /ecs/global-gaming-platform-frontend --follow --region $AWS_REGION"
echo "aws logs tail /ecs/global-gaming-platform-leaderboard-service --follow --region $AWS_REGION"
echo "aws logs tail /ecs/global-gaming-platform-auth-service --follow --region $AWS_REGION"
