#!/bin/bash

# Deploy Game Engine to ECS
# This script builds, pushes, and deploys the game-engine service

set -e

echo "=========================================="
echo "Game Engine Deployment Script"
echo "=========================================="
echo ""

# Configuration
AWS_REGION="eu-west-2"
AWS_ACCOUNT_ID="981686514879"
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/global-gaming-platform/game-engine"
ECS_CLUSTER="global-gaming-platform-cluster"
ECS_SERVICE="global-gaming-platform-game-engine"
IMAGE_TAG="${1:-latest}"

echo "Configuration:"
echo "  AWS Region: ${AWS_REGION}"
echo "  ECR Repository: ${ECR_REPO}"
echo "  Image Tag: ${IMAGE_TAG}"
echo "  ECS Cluster: ${ECS_CLUSTER}"
echo "  ECS Service: ${ECS_SERVICE}"
echo ""

# Step 1: Login to ECR
echo "Step 1: Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
echo "✅ Logged in to ECR"
echo ""

# Step 2: Build Docker image
echo "Step 2: Building Docker image..."
cd src/game-engine
docker build -t game-engine:${IMAGE_TAG} .
echo "✅ Docker image built"
echo ""

# Step 3: Tag image
echo "Step 3: Tagging image..."
docker tag game-engine:${IMAGE_TAG} ${ECR_REPO}:${IMAGE_TAG}
echo "✅ Image tagged"
echo ""

# Step 4: Push to ECR
echo "Step 4: Pushing image to ECR..."
docker push ${ECR_REPO}:${IMAGE_TAG}
echo "✅ Image pushed to ECR"
echo ""

# Step 5: Verify image in ECR
echo "Step 5: Verifying image in ECR..."
aws ecr describe-images \
    --repository-name global-gaming-platform/game-engine \
    --region ${AWS_REGION} \
    --query 'imageDetails[?contains(imageTags, `'${IMAGE_TAG}'`)].{Tag:imageTags[0],Digest:imageDigest,Pushed:imagePushedAt}' \
    --output table
echo ""

# Step 6: Force new ECS deployment
echo "Step 6: Forcing new ECS deployment..."
aws ecs update-service \
    --cluster ${ECS_CLUSTER} \
    --service ${ECS_SERVICE} \
    --force-new-deployment \
    --region ${AWS_REGION} \
    --query 'service.{Name:serviceName,Status:status,Desired:desiredCount,Running:runningCount}' \
    --output table
echo "✅ Deployment initiated"
echo ""

# Step 7: Monitor deployment
echo "Step 7: Monitoring deployment (this may take a few minutes)..."
echo "Waiting for service to stabilize..."

aws ecs wait services-stable \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION} && echo "✅ Service is stable!" || echo "⚠️  Timeout waiting for service to stabilize"

echo ""

# Step 8: Check service status
echo "Step 8: Final service status..."
aws ecs describe-services \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION} \
    --query 'services[0].{Name:serviceName,Status:status,Desired:desiredCount,Running:runningCount,Pending:pendingCount}' \
    --output table

echo ""

# Step 9: Get ALB endpoint
echo "Step 9: Application endpoint..."
cd ../../infrastructure/terraform/environments/dev
ALB_DNS=$(terraform output -raw alb_dns_name 2>/dev/null || echo "Not available")
echo "ALB DNS: http://${ALB_DNS}"
echo ""

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test the endpoint: curl http://${ALB_DNS}/health"
echo "2. Check logs: aws logs tail /aws/ecs/global-gaming-platform/game-engine --follow"
echo "3. Monitor tasks: aws ecs list-tasks --cluster ${ECS_CLUSTER} --service-name ${ECS_SERVICE}"
echo ""
