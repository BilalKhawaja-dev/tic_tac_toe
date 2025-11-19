#!/bin/bash

# Cleanup ECR Repositories and Destroy Infrastructure
# Deletes all images from ECR repos before destroying

set -e

echo "=========================================="
echo "ECR Cleanup and Infrastructure Destruction"
echo "=========================================="
echo ""

AWS_REGION=${AWS_REGION:-eu-west-2}

# List of ECR repositories
REPOS=(
  "global-gaming-platform/game-engine"
  "global-gaming-platform/leaderboard-service"
  "global-gaming-platform/auth-service"
  "global-gaming-platform/frontend"
)

echo "Cleaning up ECR repositories in $AWS_REGION..."
echo ""

for REPO in "${REPOS[@]}"; do
  echo "Processing repository: $REPO"
  
  # Get all image digests
  IMAGE_DIGESTS=$(aws ecr list-images \
    --repository-name "$REPO" \
    --region $AWS_REGION \
    --query 'imageIds[*].imageDigest' \
    --output text 2>/dev/null || echo "")
  
  if [ -z "$IMAGE_DIGESTS" ]; then
    echo "  ✓ Repository is empty or doesn't exist"
  else
    echo "  Found images, deleting..."
    
    # Delete all images
    aws ecr batch-delete-image \
      --repository-name "$REPO" \
      --region $AWS_REGION \
      --image-ids $(aws ecr list-images --repository-name "$REPO" --region $AWS_REGION --query 'imageIds[*]' --output json) \
      2>/dev/null || echo "  ⚠ Could not delete images"
    
    echo "  ✓ Images deleted"
  fi
  echo ""
done

echo "=========================================="
echo "Running Terraform Destroy"
echo "=========================================="
echo ""

cd infrastructure/terraform/environments/dev

# Run terraform destroy
terraform destroy -auto-approve

echo ""
echo "=========================================="
echo "Cleanup Complete!"
echo "=========================================="
echo ""
echo "All ECR images and AWS resources have been destroyed."
echo "You can now test locally using docker-compose."
