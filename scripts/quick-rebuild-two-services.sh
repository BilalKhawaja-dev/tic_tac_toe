#!/bin/bash
# Quick rebuild for leaderboard and auth services

set -e

AWS_REGION=eu-west-2
AWS_ACCOUNT_ID=981686514879
CLUSTER_NAME="global-gaming-platform-cluster"

echo "Rebuilding leaderboard and auth services..."

# Build leaderboard
echo "1/2 Building leaderboard..."
docker build -t leaderboard:latest src/leaderboard-service/
docker tag leaderboard:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/leaderboard-service:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/leaderboard-service:latest
echo "✓ Leaderboard pushed"

# Build auth
echo "2/2 Building auth..."
docker build -t auth:latest src/auth-service/
docker tag auth:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/auth-service:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/auth-service:latest
echo "✓ Auth pushed"

# Force deployments
echo "Forcing deployments..."
aws ecs update-service --cluster $CLUSTER_NAME --service global-gaming-platform-leaderboard-service --force-new-deployment --region $AWS_REGION --no-cli-pager
aws ecs update-service --cluster $CLUSTER_NAME --service global-gaming-platform-auth-service --force-new-deployment --region $AWS_REGION --no-cli-pager

echo "✓ Done! Monitor logs with:"
echo "aws logs tail /ecs/global-gaming-platform-leaderboard-service --follow --region $AWS_REGION"
echo "aws logs tail /ecs/global-gaming-platform-auth-service --follow --region $AWS_REGION"
