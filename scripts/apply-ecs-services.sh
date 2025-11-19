#!/bin/bash
# Apply Terraform changes to create missing ECS services
set -e

REGION=eu-west-2

echo "==================================="
echo "  Creating ECS Services via Terraform"
echo "==================================="
echo "Region: ${REGION}"
echo ""

cd infrastructure/terraform/environments/dev

echo "Step 1: Terraform Init..."
terraform init

echo ""
echo "Step 2: Terraform Plan..."
terraform plan -out=tfplan

echo ""
echo "Step 3: Terraform Apply..."
terraform apply tfplan

echo ""
echo "==================================="
echo "  ECS Services Created!"
echo "==================================="
echo ""
echo "Services created:"
echo "  - global-gaming-platform-auth-service"
echo "  - global-gaming-platform-leaderboard-service"
echo "  - global-gaming-platform-frontend"
echo ""
echo "Next steps:"
echo "  1. Build and push Docker images:"
echo "     ./scripts/deploy-all-services.sh"
echo ""
echo "  2. Check service status:"
echo "     ./scripts/check-all-services.sh"
echo ""
echo "ALB Path-Based Routing:"
echo "  /api/auth/*        → auth-service:3001"
echo "  /api/user/*        → auth-service:3001"
echo "  /api/leaderboard/* → leaderboard-service:3002"
echo "  /api/game/*        → game-engine:3000"
echo "  /*                 → frontend:80"
