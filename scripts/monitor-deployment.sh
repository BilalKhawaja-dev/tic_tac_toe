#!/bin/bash

# Monitor ECS service deployment progress

CLUSTER="global-gaming-platform-cluster"
REGION="eu-west-2"
ALB_DNS="global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com"

echo "Monitoring deployment progress..."
echo "================================"
echo ""

for i in {1..30}; do
  echo "Check #$i at $(date +%H:%M:%S)"
  echo ""
  
  # Check service status
  aws ecs describe-services \
    --cluster $CLUSTER \
    --services global-gaming-platform-leaderboard-service global-gaming-platform-game-engine \
    --region $REGION \
    --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount,pending:pendingCount}' \
    --output table
  
  echo ""
  
  # Test endpoints
  echo "Testing endpoints:"
  echo "  Game Engine /api/game/health: $(curl -s -o /dev/null -w '%{http_code}' http://$ALB_DNS/api/game/health)"
  echo "  Game Engine /api/game/status: $(curl -s -o /dev/null -w '%{http_code}' http://$ALB_DNS/api/game/status)"
  echo "  Leaderboard /api/leaderboard/health: $(curl -s -o /dev/null -w '%{http_code}' http://$ALB_DNS/api/leaderboard/health)"
  echo "  Leaderboard /api/leaderboard/global: $(curl -s -o /dev/null -w '%{http_code}' http://$ALB_DNS/api/leaderboard/global)"
  
  echo ""
  echo "---"
  echo ""
  
  sleep 10
done

echo "Monitoring complete!"
