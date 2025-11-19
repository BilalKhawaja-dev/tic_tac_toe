#!/bin/bash

# Check ECS Deployment Status

echo "=========================================="
echo "ECS Deployment Status Check"
echo "=========================================="
echo ""

# Check service status
echo "Service Status:"
aws ecs describe-services \
  --cluster global-gaming-platform-cluster \
  --services global-gaming-platform-game-engine \
  --region eu-west-2 \
  --query 'services[0].{Name:serviceName,Status:status,Desired:desiredCount,Running:runningCount,Pending:pendingCount}' \
  --output table

echo ""
echo "Recent Events:"
aws ecs describe-services \
  --cluster global-gaming-platform-cluster \
  --services global-gaming-platform-game-engine \
  --region eu-west-2 \
  --query 'services[0].events[0:3]' \
  --output table

echo ""
echo "Task Status:"
TASKS=$(aws ecs list-tasks --cluster global-gaming-platform-cluster --service-name global-gaming-platform-game-engine --region eu-west-2 --query 'taskArns[0]' --output text)

if [ "$TASKS" != "None" ] && [ ! -z "$TASKS" ]; then
  aws ecs describe-tasks \
    --cluster global-gaming-platform-cluster \
    --tasks $TASKS \
    --region eu-west-2 \
    --query 'tasks[0].{TaskArn:taskArn,Status:lastStatus,Health:healthStatus,Started:startedAt}' \
    --output table
  
  echo ""
  echo "Container Status:"
  aws ecs describe-tasks \
    --cluster global-gaming-platform-cluster \
    --tasks $TASKS \
    --region eu-west-2 \
    --query 'tasks[0].containers[0].{Name:name,Status:lastStatus,ExitCode:exitCode,Reason:reason}' \
    --output table
else
  echo "No tasks currently running"
fi

echo ""
echo "ALB Target Health:"
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:eu-west-2:981686514879:targetgroup/ggp-development-game-tg/fdc30e66239a6baa \
  --region eu-west-2 \
  --query 'TargetHealthDescriptions[*].{Target:Target.Id,Port:Target.Port,Health:TargetHealth.State,Reason:TargetHealth.Reason}' \
  --output table

echo ""
echo "=========================================="
echo "To view logs:"
echo "aws logs tail /aws/ecs/global-gaming-platform/game-engine --follow --region eu-west-2"
echo ""
echo "To test the endpoint:"
echo "curl http://global-gaming-platform-alb-1720380409.eu-west-2.elb.amazonaws.com/health"
echo "=========================================="
