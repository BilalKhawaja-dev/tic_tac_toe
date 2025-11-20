#!/bin/bash
# Check status of all deployed services
set -e

REGION=eu-west-2
CLUSTER="global-gaming-platform-cluster"

echo "==================================="
echo "  Service Status Check"
echo "==================================="
echo "Region: ${REGION}"
echo "Cluster: ${CLUSTER}"
echo ""

# Function to check service status
check_service() {
  local SERVICE_NAME=$1
  
  echo "Checking: ${SERVICE_NAME}"
  echo "-----------------------------------"
  
  aws ecs describe-services \
    --region ${REGION} \
    --cluster ${CLUSTER} \
    --services ${SERVICE_NAME} \
    --query 'services[0].{Status:status,Desired:desiredCount,Running:runningCount,Pending:pendingCount}' \
    --output table 2>/dev/null || echo "❌ Service not found or error"
  
  echo ""
}

# Check all services
check_service "global-gaming-platform-game-engine"
check_service "global-gaming-platform-auth-service"
check_service "global-gaming-platform-leaderboard-service"
check_service "global-gaming-platform-frontend"

echo "==================================="
echo "  Target Group Health"
echo "==================================="
echo ""

# Function to check target group health
check_target_group() {
  local TG_NAME=$1
  local TG_ARN=$(aws elbv2 describe-target-groups \
    --region ${REGION} \
    --query "TargetGroups[?TargetGroupName=='${TG_NAME}'].TargetGroupArn" \
    --output text 2>/dev/null)
  
  if [ -n "$TG_ARN" ]; then
    echo "Target Group: ${TG_NAME}"
    echo "-----------------------------------"
    aws elbv2 describe-target-health \
      --region ${REGION} \
      --target-group-arn ${TG_ARN} \
      --query 'TargetHealthDescriptions[*].{IP:Target.Id,Port:Target.Port,State:TargetHealth.State,Reason:TargetHealth.Reason}' \
      --output table 2>/dev/null || echo "No targets"
    echo ""
  fi
}

check_target_group "ggp-development-game-tg"
check_target_group "ggp-development-auth-tg"
check_target_group "ggp-development-leaderboard-tg"
check_target_group "ggp-development-frontend-tg"

echo "==================================="
echo "  Load Balancer"
echo "==================================="
echo ""

LB_ARN=$(aws elbv2 describe-load-balancers \
  --region ${REGION} \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>/dev/null)

if [ -n "$LB_ARN" ]; then
  aws elbv2 describe-load-balancers \
    --region ${REGION} \
    --load-balancer-arns ${LB_ARN} \
    --query 'LoadBalancers[0].{DNS:DNSName,State:State.Code,Type:Type}' \
    --output table
fi

echo ""
echo "==================================="
echo "Quick Commands:"
echo "==================================="
echo "View logs:"
echo "  aws logs tail /ecs/game-engine --region ${REGION} --follow"
echo "  aws logs tail /ecs/auth-service --region ${REGION} --follow"
echo "  aws logs tail /ecs/leaderboard-service --region ${REGION} --follow"
echo "  aws logs tail /ecs/frontend --region ${REGION} --follow"
echo ""
echo "Force redeploy:"
echo "  ./scripts/deploy-all-services.sh"
