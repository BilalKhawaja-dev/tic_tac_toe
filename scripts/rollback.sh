#!/bin/bash

# Automated Rollback Script
# Handles rollback to previous deployment version

set -e

# Configuration
ENVIRONMENT=${1:-"development"}
SERVICE=${2:-""}
REASON=${3:-"Manual rollback"}

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================"
echo "Rollback Script"
echo "================================"
echo "Environment: $ENVIRONMENT"
echo "Service: $SERVICE"
echo "Reason: $REASON"
echo "================================"
echo ""

if [ -z "$SERVICE" ]; then
  echo -e "${RED}Error: Service name required${NC}"
  echo "Usage: $0 <environment> <service> [reason]"
  exit 1
fi

# Function to rollback ECS service
rollback_ecs_service() {
  local service_name=$1
  local cluster_name="gaming-platform-${ENVIRONMENT}"
  local ecs_service="${service_name}-service"
  
  echo -e "${YELLOW}Rolling back ECS service: $ecs_service${NC}"
  
  # Get current task definition
  current_task_def=$(aws ecs describe-services \
    --cluster "$cluster_name" \
    --services "$ecs_service" \
    --region eu-west-2 \
    --query 'services[0].taskDefinition' \
    --output text)
  
  echo "Current task definition: $current_task_def"
  
  # Get previous task definition
  task_family=$(echo $current_task_def | cut -d'/' -f2 | cut -d':' -f1)
  current_revision=$(echo $current_task_def | cut -d':' -f2)
  previous_revision=$((current_revision - 1))
  
  if [ $previous_revision -lt 1 ]; then
    echo -e "${RED}✗ No previous revision available${NC}"
    return 1
  fi
  
  previous_task_def="${task_family}:${previous_revision}"
  echo "Rolling back to: $previous_task_def"
  
  # Update service with previous task definition
  aws ecs update-service \
    --cluster "$cluster_name" \
    --service "$ecs_service" \
    --task-definition "$previous_task_def" \
    --region eu-west-2 \
    --force-new-deployment
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Rollback initiated successfully${NC}"
    return 0
  else
    echo -e "${RED}✗ Rollback failed${NC}"
    return 1
  fi
}

# Function to rollback CodeDeploy deployment
rollback_codedeploy() {
  local service_name=$1
  local application_name="gaming-platform-${service_name}"
  local deployment_group="${application_name}-dg"
  
  echo -e "${YELLOW}Rolling back CodeDeploy deployment${NC}"
  
  # Get latest deployment
  deployment_id=$(aws deploy list-deployments \
    --application-name "$application_name" \
    --deployment-group-name "$deployment_group" \
    --region eu-west-2 \
    --query 'deployments[0]' \
    --output text)
  
  if [ -z "$deployment_id" ] || [ "$deployment_id" = "None" ]; then
    echo -e "${YELLOW}⚠ No active deployment found, using ECS rollback${NC}"
    rollback_ecs_service "$service_name"
    return $?
  fi
  
  echo "Stopping deployment: $deployment_id"
  
  # Stop the deployment (triggers automatic rollback)
  aws deploy stop-deployment \
    --deployment-id "$deployment_id" \
    --auto-rollback-enabled \
    --region eu-west-2
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Rollback initiated successfully${NC}"
    return 0
  else
    echo -e "${RED}✗ Rollback failed${NC}"
    return 1
  fi
}

# Function to send notification
send_notification() {
  local status=$1
  local message=$2
  
  aws sns publish \
    --topic-arn "arn:aws:sns:eu-west-2:${AWS_ACCOUNT_ID}:deployment-notifications" \
    --subject "Rollback ${status}: ${SERVICE} in ${ENVIRONMENT}" \
    --message "$message" \
    --region eu-west-2 2>/dev/null || echo "SNS notification skipped"
}

# Confirmation prompt
echo -e "${RED}⚠ WARNING: This will rollback the service to the previous version${NC}"
read -p "Are you sure you want to proceed? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
  echo "Rollback cancelled"
  exit 0
fi

echo ""
echo "Initiating rollback..."

# Attempt CodeDeploy rollback first, fallback to ECS
if rollback_codedeploy "$SERVICE"; then
  send_notification "SUCCESS" "Rollback completed successfully. Reason: $REASON"
  echo ""
  echo -e "${GREEN}================================${NC}"
  echo -e "${GREEN}Rollback completed successfully!${NC}"
  echo -e "${GREEN}================================${NC}"
  exit 0
else
  echo -e "${YELLOW}CodeDeploy rollback failed, attempting ECS rollback...${NC}"
  if rollback_ecs_service "$SERVICE"; then
    send_notification "SUCCESS" "Rollback completed via ECS. Reason: $REASON"
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}Rollback completed successfully!${NC}"
    echo -e "${GREEN}================================${NC}"
    exit 0
  else
    send_notification "FAILED" "Rollback failed. Manual intervention required. Reason: $REASON"
    echo ""
    echo -e "${RED}================================${NC}"
    echo -e "${RED}Rollback failed!${NC}"
    echo -e "${RED}================================${NC}"
    exit 1
  fi
fi
