#!/bin/bash

# Quick Start Script for Terraform Deployment
# This script guides you through the entire deployment process

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Global Gaming Platform - Quick Start${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    echo "Install: https://aws.amazon.com/cli/"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI installed${NC}"

if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform not found${NC}"
    echo "Install: https://www.terraform.io/downloads"
    exit 1
fi
echo -e "${GREEN}✓ Terraform installed${NC}"

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi
echo -e "${GREEN}✓ AWS credentials configured${NC}"

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)
echo -e "${GREEN}✓ AWS Account: $AWS_ACCOUNT${NC}"
echo -e "${GREEN}✓ AWS Region: $AWS_REGION${NC}"

echo ""

# Step 2: Setup backend
echo -e "${YELLOW}Step 2: Setting up Terraform backend...${NC}"

BUCKET_NAME="global-gaming-platform-terraform-state-dev"

if aws s3 ls "s3://$BUCKET_NAME" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "Creating S3 bucket for Terraform state..."
    aws s3api create-bucket \
      --bucket $BUCKET_NAME \
      --region $AWS_REGION \
      --create-bucket-configuration LocationConstraint=$AWS_REGION
    
    aws s3api put-bucket-versioning \
      --bucket $BUCKET_NAME \
      --versioning-configuration Status=Enabled
    
    aws s3api put-bucket-encryption \
      --bucket $BUCKET_NAME \
      --server-side-encryption-configuration '{
        "Rules": [{
          "ApplyServerSideEncryptionByDefault": {
            "SSEAlgorithm": "AES256"
          }
        }]
      }'
    
    echo -e "${GREEN}✓ S3 bucket created${NC}"
else
    echo -e "${GREEN}✓ S3 bucket already exists${NC}"
fi

if aws dynamodb describe-table --table-name terraform-state-lock --region $AWS_REGION &> /dev/null; then
    echo -e "${GREEN}✓ DynamoDB table already exists${NC}"
else
    echo "Creating DynamoDB table for state locking..."
    aws dynamodb create-table \
      --table-name terraform-state-lock \
      --attribute-definitions AttributeName=LockID,AttributeType=S \
      --key-schema AttributeName=LockID,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST \
      --region $AWS_REGION
    
    echo -e "${GREEN}✓ DynamoDB table created${NC}"
fi

echo ""

# Step 3: Configure variables
echo -e "${YELLOW}Step 3: Configuring Terraform variables...${NC}"

cd infrastructure/terraform/environments/dev

if [ ! -f "terraform.tfvars" ]; then
    if [ -f "terraform.tfvars.example" ]; then
        cp terraform.tfvars.example terraform.tfvars
        echo -e "${YELLOW}⚠ Created terraform.tfvars from example${NC}"
        echo -e "${YELLOW}⚠ Please update the following values:${NC}"
        echo "  - alert_email"
        echo "  - github_repo"
        echo ""
        read -p "Press Enter to edit terraform.tfvars (or Ctrl+C to exit)..."
        ${EDITOR:-nano} terraform.tfvars
    else
        echo -e "${RED}❌ No terraform.tfvars.example found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ terraform.tfvars already exists${NC}"
fi

echo ""

# Step 4: Initialize Terraform
echo -e "${YELLOW}Step 4: Initializing Terraform...${NC}"
terraform init -upgrade
echo -e "${GREEN}✓ Terraform initialized${NC}"

echo ""

# Step 5: Validate configuration
echo -e "${YELLOW}Step 5: Validating configuration...${NC}"
terraform validate
echo -e "${GREEN}✓ Configuration valid${NC}"

echo ""

# Step 6: Plan deployment
echo -e "${YELLOW}Step 6: Planning deployment...${NC}"
terraform plan -out=tfplan

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Plan Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Review the plan above carefully."
echo ""
echo -e "${YELLOW}Estimated deployment time: 30-45 minutes${NC}"
echo -e "${YELLOW}Estimated monthly cost: \$350-520${NC}"
echo ""

read -p "Do you want to apply this plan? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
    echo ""
    echo -e "${YELLOW}Step 7: Applying Terraform plan...${NC}"
    echo "This will take 30-45 minutes..."
    
    terraform apply tfplan
    rm -f tfplan
    
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}Deployment Complete! 🎉${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    
    # Show outputs
    echo -e "${YELLOW}Infrastructure Outputs:${NC}"
    terraform output
    
    echo ""
    echo -e "${GREEN}Next Steps:${NC}"
    echo "1. Configure Cognito OAuth providers"
    echo "2. Store secrets in Secrets Manager"
    echo "3. Confirm SNS email subscription"
    echo "4. Push code to GitHub to trigger CI/CD"
    echo "5. Run smoke tests: ./scripts/smoke-tests.sh"
    echo ""
    echo "See TERRAFORM_DEPLOYMENT_GUIDE.md for details"
    
else
    echo ""
    echo -e "${YELLOW}Deployment cancelled${NC}"
    echo "To apply later, run:"
    echo "  cd infrastructure/terraform/environments/dev"
    echo "  terraform apply tfplan"
fi
