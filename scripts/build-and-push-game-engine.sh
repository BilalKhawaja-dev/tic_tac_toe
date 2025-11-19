#!/bin/bash
# Build and push game engine Docker image
set -e

REGION=eu-west-2
ACCOUNT_ID=981686514879
REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/global-gaming-platform/game-engine"
TAG="health-fix-$(date +%Y%m%d-%H%M%S)"

echo "=== Building and Pushing Game Engine ==="
echo "Tag: ${TAG}"
echo ""

# Login to ECR
echo "1. Logging into ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REPO}

# Build
echo ""
echo "2. Building Docker image..."
docker build -t game-engine:${TAG} -t game-engine:latest src/game-engine/

# Tag
echo ""
echo "3. Tagging for ECR..."
docker tag game-engine:${TAG} ${REPO}:${TAG}
docker tag game-engine:latest ${REPO}:latest

# Push
echo ""
echo "4. Pushing to ECR..."
docker push ${REPO}:${TAG}
docker push ${REPO}:latest

# Force deployment
echo ""
echo "5. Forcing ECS deployment..."
aws ecs update-service \
  --region ${REGION} \
  --cluster global-gaming-platform-cluster \
  --service global-gaming-platform-game-engine \
  --force-new-deployment \
  --no-cli-pager

echo ""
echo "=== Done! ==="
echo "Image: ${REPO}:${TAG}"
echo ""
echo "Monitor deployment:"
echo "  watch -n 5 'aws elbv2 describe-target-health --region ${REGION} --target-group-arn arn:aws:elasticloadbalancing:${REGION}:${ACCOUNT_ID}:targetgroup/ggp-development-game-tg/fdc30e66239a6baa --query \"TargetHealthDescriptions[*].{IP:Target.Id,Port:Target.Port,State:TargetHealth.State,Reason:TargetHealth.Reason}\" --output table'"
