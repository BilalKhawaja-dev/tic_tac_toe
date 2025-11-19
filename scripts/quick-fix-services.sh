#!/bin/bash
# Quick fix - Just rebuild and redeploy services without Terraform

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-eu-west-2}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=========================================="
echo "Quick Service Fix"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "=========================================="

# Login to ECR
echo ""
echo "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Step 1: Update target group to port 8080
echo ""
echo "Step 1: Updating target group port..."
TG_ARN=$(aws elbv2 describe-target-groups \
  --names ggp-$ENVIRONMENT-frontend-tg \
  --region $AWS_REGION \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text 2>/dev/null || echo "")

if [ -n "$TG_ARN" ]; then
  aws elbv2 modify-target-group \
    --target-group-arn $TG_ARN \
    --port 8080 \
    --health-check-path /health \
    --region $AWS_REGION
  echo "✓ Target group updated to port 8080"
else
  echo "⚠ Target group not found, skipping..."
fi

# Step 2: Rebuild and push frontend
echo ""
echo "Step 2: Rebuilding frontend..."
cd src/frontend
docker build -t ggp-frontend:latest .
docker tag ggp-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/frontend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/frontend:latest
echo "✓ Frontend image pushed"
cd ../..

# Step 3: Rebuild and push leaderboard service
echo ""
echo "Step 3: Rebuilding leaderboard service..."
cd src/leaderboard-service
docker build -t ggp-leaderboard-service:latest .
docker tag ggp-leaderboard-service:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/leaderboard-service:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/global-gaming-platform/leaderboard-service:latest
echo "✓ Leaderboard service image pushed"
cd ../..

# Step 4: Force new deployments
echo ""
echo "Step 4: Forcing new deployments..."

CLUSTER_NAME="global-gaming-platform-cluster"

aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service global-gaming-platform-frontend \
  --force-new-deployment \
  --region $AWS_REGION \
  --no-cli-pager

aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service global-gaming-platform-leaderboard-service \
  --force-new-deployment \
  --region $AWS_REGION \
  --no-cli-pager

echo "✓ Deployments initiated"

# Step 5: Monitor deployment
echo ""
echo "Step 5: Monitoring deployments (this may take a few minutes)..."
echo ""

for service in frontend leaderboard-service; do
  echo "Waiting for global-gaming-platform-$service..."
  aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services global-gaming-platform-$service \
    --region $AWS_REGION &
done

wait

echo ""
echo "=========================================="
echo "✓ All services deployed successfully!"
echo "=========================================="
echo ""
echo "Check service health:"
echo ""

# Get ALB DNS
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --region $AWS_REGION \
  --query 'LoadBalancers[0].DNSName' \
  --output text 2>/dev/null || echo "")

if [ -n "$ALB_DNS" ]; then
  echo "Frontend: http://$ALB_DNS/"
  echo "Leaderboard: http://$ALB_DNS/api/leaderboard/global"
  echo ""
  echo "Testing frontend health..."
  curl -s -o /dev/null -w "Status: %{http_code}\n" http://$ALB_DNS/health || echo "Health check failed"
fi

echo ""
echo "View logs:"
echo "aws logs tail /ecs/ggp-$ENVIRONMENT-frontend --follow --region $AWS_REGION"
echo "aws logs tail /ecs/ggp-$ENVIRONMENT-leaderboard-service --follow --region $AWS_REGION"
