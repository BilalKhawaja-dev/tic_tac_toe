#!/bin/bash

# Create ECR Repositories Script
# Creates all required ECR repositories for the gaming platform

set -e

AWS_REGION=${AWS_REGION:-eu-west-2}

echo "=========================================="
echo "Creating ECR Repositories"
echo "Region: $AWS_REGION"
echo "=========================================="

# List of repositories to create
REPOS=(
  "gaming-platform-frontend"
  "gaming-platform-auth-service"
  "gaming-platform-leaderboard-service"
  "gaming-platform-game-engine"
)

# Create each repository
for REPO in "${REPOS[@]}"; do
  echo ""
  echo "Creating repository: $REPO"
  
  # Check if repository already exists
  if aws ecr describe-repositories --repository-names "$REPO" --region $AWS_REGION 2>/dev/null; then
    echo "✓ Repository $REPO already exists"
  else
    # Create repository
    aws ecr create-repository \
      --repository-name "$REPO" \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 \
      --region $AWS_REGION
    
    echo "✓ Created repository: $REPO"
    
    # Set lifecycle policy to keep only last 10 images
    aws ecr put-lifecycle-policy \
      --repository-name "$REPO" \
      --lifecycle-policy-text '{
        "rules": [
          {
            "rulePriority": 1,
            "description": "Keep only last 10 images",
            "selection": {
              "tagStatus": "any",
              "countType": "imageCountMoreThan",
              "countNumber": 10
            },
            "action": {
              "type": "expire"
            }
          }
        ]
      }' \
      --region $AWS_REGION
    
    echo "✓ Set lifecycle policy for $REPO"
  fi
done

echo ""
echo "=========================================="
echo "ECR Repositories Ready"
echo "=========================================="
echo ""
echo "Created/Verified repositories:"
for REPO in "${REPOS[@]}"; do
  echo "  ✓ $REPO"
done
echo ""
echo "You can now build and push Docker images to these repositories."
