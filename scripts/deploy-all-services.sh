#!/bin/bash
# Deploy all services to AWS
set -e

REGION=eu-west-2
ACCOUNT_ID=981686514879
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "==================================="
echo "  Multi-Service Deployment Script"
echo "==================================="
echo "Region: ${REGION}"
echo "Account: ${ACCOUNT_ID}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Login to ECR once
echo "Logging into ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
echo ""

# Function to build and push a service
deploy_service() {
  local SERVICE_NAME=$1
  local SERVICE_DIR=$2
  local ECR_REPO=$3
  
  echo "==================================="
  echo "Deploying: ${SERVICE_NAME}"
  echo "==================================="
  
  # Build
  echo "Building ${SERVICE_NAME}..."
  docker build -t ${SERVICE_NAME}:${TIMESTAMP} -t ${SERVICE_NAME}:latest ${SERVICE_DIR}
  
  # Tag
  echo "Tagging ${SERVICE_NAME}..."
  docker tag ${SERVICE_NAME}:${TIMESTAMP} ${ECR_REPO}:${TIMESTAMP}
  docker tag ${SERVICE_NAME}:latest ${ECR_REPO}:latest
  
  # Push
  echo "Pushing ${SERVICE_NAME}..."
  docker push ${ECR_REPO}:${TIMESTAMP}
  docker push ${ECR_REPO}:latest
  
  echo "✅ ${SERVICE_NAME} image pushed successfully"
  echo ""
}

# Function to update ECS service
update_ecs_service() {
  local SERVICE_NAME=$1
  
  echo "Updating ECS service: ${SERVICE_NAME}..."
  aws ecs update-service \
    --region ${REGION} \
    --cluster global-gaming-platform-cluster \
    --service ${SERVICE_NAME} \
    --force-new-deployment \
    --no-cli-pager > /dev/null
  
  echo "✅ ${SERVICE_NAME} deployment triggered"
  echo ""
}

# Deploy Auth Service
deploy_service \
  "auth-service" \
  "src/auth-service" \
  "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform/auth-service"

update_ecs_service "global-gaming-platform-auth-service"

# Deploy Leaderboard Service
deploy_service \
  "leaderboard-service" \
  "src/leaderboard-service" \
  "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform/leaderboard-service"

update_ecs_service "global-gaming-platform-leaderboard-service"

# Deploy Frontend
deploy_service \
  "frontend" \
  "src/frontend" \
  "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform/frontend"

update_ecs_service "global-gaming-platform-frontend"

echo "==================================="
echo "  Deployment Summary"
echo "==================================="
echo "✅ auth-service deployed"
echo "✅ leaderboard-service deployed"
echo "✅ frontend deployed"
echo ""
echo "Monitor deployments:"
echo "  aws ecs list-services --region ${REGION} --cluster global-gaming-platform-cluster"
echo ""
echo "Check service status:"
echo "  aws ecs describe-services --region ${REGION} --cluster global-gaming-platform-cluster --services global-gaming-platform-auth-service global-gaming-platform-leaderboard-service global-gaming-platform-frontend"
echo ""
echo "View logs:"
echo "  aws logs tail /ecs/auth-service --region ${REGION} --follow"
echo "  aws logs tail /ecs/leaderboard-service --region ${REGION} --follow"
echo "  aws logs tail /ecs/frontend --region ${REGION} --follow"
