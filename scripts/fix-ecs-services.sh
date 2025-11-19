#!/bin/bash
# Fix ECS Services - Rebuild and redeploy frontend and leaderboard services

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=========================================="
echo "Fixing ECS Services"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "=========================================="

# Step 1: Update task definition only (skip target group - will update via AWS CLI)
echo ""
echo "Step 1: Updating ECS task definition..."
cd infrastructure/terraform/environments/$ENVIRONMENT
terraform apply -target=module.ecs.aws_ecs_task_definition.frontend \
                -auto-approve

cd ../../../../

# Step 2: Rebuild and push frontend image
echo ""
echo "Step 2: Rebuilding frontend image..."
cd src/frontend

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and tag
docker build -t ggp-frontend:latest .
docker tag ggp-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/ggp-$ENVIRONMENT-frontend:latest

# Push to ECR
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/ggp-$ENVIRONMENT-frontend:latest

cd ../..

# Step 3: Rebuild and push leaderboard service image
echo ""
echo "Step 3: Rebuilding leaderboard service image..."
cd src/leaderboard-service

# Build and tag
docker build -t ggp-leaderboard-service:latest .
docker tag ggp-leaderboard-service:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/ggp-$ENVIRONMENT-leaderboard-service:latest

# Push to ECR
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/ggp-$ENVIRONMENT-leaderboard-service:latest

cd ../..

# Step 4: Update target group port
echo ""
echo "Step 4: Updating target group port..."

# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups \
  --names ggp-$ENVIRONMENT-frontend-tg \
  --region $AWS_REGION \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Update target group port
aws elbv2 modify-target-group \
  --target-group-arn $TG_ARN \
  --port 8080 \
  --health-check-path /health \
  --region $AWS_REGION

echo "Target group updated to port 8080"

# Step 5: Force new deployment for both services
echo ""
echo "Step 5: Forcing new deployments..."

# Update frontend service
aws ecs update-service \
  --cluster ggp-$ENVIRONMENT-cluster \
  --service ggp-$ENVIRONMENT-frontend \
  --force-new-deployment \
  --region $AWS_REGION

# Update leaderboard service
aws ecs update-service \
  --cluster ggp-$ENVIRONMENT-cluster \
  --service ggp-$ENVIRONMENT-leaderboard-service \
  --force-new-deployment \
  --region $AWS_REGION

# Step 6: Wait for services to stabilize
echo ""
echo "Step 6: Waiting for services to stabilize..."

echo "Waiting for frontend service..."
aws ecs wait services-stable \
  --cluster ggp-$ENVIRONMENT-cluster \
  --services ggp-$ENVIRONMENT-frontend \
  --region $AWS_REGION

echo "Waiting for leaderboard service..."
aws ecs wait services-stable \
  --cluster ggp-$ENVIRONMENT-cluster \
  --services ggp-$ENVIRONMENT-leaderboard-service \
  --region $AWS_REGION

# Step 7: Check service status
echo ""
echo "=========================================="
echo "Service Status"
echo "=========================================="

for service in frontend leaderboard-service; do
  echo ""
  echo "Service: $service"
  aws ecs describe-services \
    --cluster ggp-$ENVIRONMENT-cluster \
    --services ggp-$ENVIRONMENT-$service \
    --region $AWS_REGION \
    --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,Deployments:deployments[*].{Status:status,Running:runningCount,Desired:desiredCount}}' \
    --output table
done

echo ""
echo "=========================================="
echo "Fix Complete!"
echo "=========================================="
echo ""
echo "Check CloudWatch Logs to verify services are running correctly:"
echo "- Frontend: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#logsV2:log-groups/log-group/\$252Fecs\$252Fggp-$ENVIRONMENT-frontend"
echo "- Leaderboard: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#logsV2:log-groups/log-group/\$252Fecs\$252Fggp-$ENVIRONMENT-leaderboard-service"
