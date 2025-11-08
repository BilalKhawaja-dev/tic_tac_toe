#!/bin/bash

# Automated Deployment Script
# Handles deployment with approval workflows and notifications

set -e

# Configuration
ENVIRONMENT=${1:-"development"}
SERVICE=${2:-"all"}
APPROVAL_REQUIRED=${3:-"false"}

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================"
echo "Deployment Script"
echo "================================"
echo "Environment: $ENVIRONMENT"
echo "Service: $SERVICE"
echo "Approval Required: $APPROVAL_REQUIRED"
echo "================================"
echo ""

# Function to deploy a service
deploy_service() {
  local service_name=$1
  
  echo -e "${YELLOW}Deploying $service_name...${NC}"
  
  # Trigger CodePipeline
  pipeline_name="gaming-platform-${service_name}-pipeline"
  
  echo "Starting pipeline: $pipeline_name"
  aws codepipeline start-pipeline-execution \
    --name "$pipeline_name" \
    --region eu-west-2
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Pipeline started successfully${NC}"
  else
    echo -e "${RED}✗ Failed to start pipeline${NC}"
    return 1
  fi
}

# Function to wait for approval
wait_for_approval() {
  if [ "$APPROVAL_REQUIRED" = "true" ]; then
    echo ""
    echo -e "${YELLOW}⚠ Manual approval required${NC}"
    echo "Please review the deployment and approve to continue."
    read -p "Approve deployment? (yes/no): " approval
    
    if [ "$approval" != "yes" ]; then
      echo -e "${RED}Deployment cancelled by user${NC}"
      exit 1
    fi
  fi
}

# Function to send notification
send_notification() {
  local status=$1
  local message=$2
  
  # Send SNS notification
  aws sns publish \
    --topic-arn "arn:aws:sns:eu-west-2:${AWS_ACCOUNT_ID}:deployment-notifications" \
    --subject "Deployment ${status}: ${ENVIRONMENT}" \
    --message "$message" \
    --region eu-west-2 2>/dev/null || echo "SNS notification skipped"
}

# Pre-deployment checks
echo "Running pre-deployment checks..."
echo "- Checking AWS credentials..."
aws sts get-caller-identity > /dev/null || {
  echo -e "${RED}✗ AWS credentials not configured${NC}"
  exit 1
}
echo -e "${GREEN}✓ AWS credentials valid${NC}"

# Wait for approval if required
wait_for_approval

# Deploy services
if [ "$SERVICE" = "all" ]; then
  echo ""
  echo "Deploying all services..."
  
  for service in game-engine auth-service leaderboard-service frontend; do
    deploy_service "$service"
    echo ""
  done
else
  deploy_service "$SERVICE"
fi

# Send success notification
send_notification "SUCCESS" "Deployment to $ENVIRONMENT completed successfully"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}================================${NC}"
