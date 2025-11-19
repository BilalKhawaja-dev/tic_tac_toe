#!/bin/bash
# Import existing ECR repositories into Terraform state
set -e

REGION=eu-west-2

echo "==================================="
echo "  Importing ECR Repositories"
echo "==================================="
echo ""

cd infrastructure/terraform/environments/dev

echo "Importing auth-service ECR repository..."
terraform import module.ecs.aws_ecr_repository.auth_service global-gaming-platform/auth-service || echo "Already imported or doesn't exist"

echo ""
echo "Importing leaderboard-service ECR repository..."
terraform import module.ecs.aws_ecr_repository.leaderboard_service global-gaming-platform/leaderboard-service || echo "Already imported or doesn't exist"

echo ""
echo "Importing frontend ECR repository..."
terraform import module.ecs.aws_ecr_repository.frontend global-gaming-platform/frontend || echo "Already imported or doesn't exist"

echo ""
echo "==================================="
echo "  Import Complete"
echo "==================================="
echo ""
echo "Now run: terraform apply"
