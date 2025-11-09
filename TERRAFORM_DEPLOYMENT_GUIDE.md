# Terraform Deployment Guide

## When to Deploy Terraform

**Deploy Terraform BEFORE deploying application code.** The infrastructure must exist before applications can run.

## Deployment Order

```
1. AWS Account Setup (Prerequisites)
2. Terraform Backend Setup (S3 + DynamoDB)
3. Terraform Infrastructure Deployment
4. Application Deployment (via CI/CD)
```

---

## Prerequisites

### 1. AWS Account Setup
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: eu-west-2
# - Default output format: json

# Verify configuration
aws sts get-caller-identity
```

### 2. Install Terraform
```bash
# Download Terraform 1.6.0+
wget https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip
unzip terraform_1.6.6_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify installation
terraform version
```

### 3. Required IAM Permissions
Your AWS user/role needs these permissions:
- EC2 (VPC, Security Groups, etc.)
- ECS (Clusters, Services, Tasks)
- RDS (Aurora)
- DynamoDB
- ElastiCache
- S3
- IAM (Roles, Policies)
- CloudWatch
- Lambda
- API Gateway
- Cognito
- KMS
- Secrets Manager

---

## Step 1: Create Terraform Environment Structure

First, we need to create the environment-specific configurations:

<function_calls>
<invoke name="executeBash">
<parameter name="command">mkdir -p infrastructure/terraform/environments/{dev,staging,production}

## Step
 2: Setup Terraform Backend (S3 + DynamoDB)

Before deploying, create the Terraform state backend:

```bash
# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket global-gaming-platform-terraform-state-dev \
  --region eu-west-2 \
  --create-bucket-configuration LocationConstraint=eu-west-2

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket global-gaming-platform-terraform-state-dev \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket global-gaming-platform-terraform-state-dev \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-2
```

---

## Step 3: Configure Terraform Variables

```bash
# Navigate to dev environment
cd infrastructure/terraform/environments/dev

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
nano terraform.tfvars
```

**Update these values:**
```hcl
project_name = "global-gaming-platform"
environment  = "dev"
aws_region   = "eu-west-2"

# IMPORTANT: Update with your email
alert_email = "your-email@example.com"

# IMPORTANT: Update with your GitHub repo
github_repo   = "your-username/tic-tac-toe"
github_branch = "develop"
```

---

## Step 4: Deploy Terraform Infrastructure

### Option A: Using the Deployment Script (Recommended)

```bash
# Run plan to see what will be created
./scripts/deploy-terraform.sh dev plan

# Review the plan, then apply
./scripts/deploy-terraform.sh dev apply
```

### Option B: Manual Deployment

```bash
# Navigate to environment directory
cd infrastructure/terraform/environments/dev

# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Plan deployment
terraform plan -out=tfplan

# Review the plan carefully!
# Check:
# - Resources to be created
# - Estimated costs
# - Security configurations

# Apply the plan
terraform apply tfplan

# Save outputs
terraform output > outputs.txt
```

---

## Step 5: Verify Deployment

```bash
# Check VPC
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=global-gaming-platform"

# Check ECS cluster
aws ecs describe-clusters --clusters global-gaming-platform-cluster-dev

# Check RDS instance
aws rds describe-db-clusters --db-cluster-identifier global-gaming-platform-aurora-dev

# Check DynamoDB tables
aws dynamodb list-tables | grep global-gaming-platform

# Check Cognito User Pool
aws cognito-idp list-user-pools --max-results 10
```

---

## Step 6: Post-Deployment Configuration

### 1. Configure Cognito OAuth Providers

```bash
# Get User Pool ID from outputs
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)

# Configure Google OAuth (example)
aws cognito-idp create-identity-provider \
  --user-pool-id $USER_POOL_ID \
  --provider-name Google \
  --provider-type Google \
  --provider-details client_id=YOUR_GOOGLE_CLIENT_ID,client_secret=YOUR_GOOGLE_CLIENT_SECRET,authorize_scopes="email profile openid" \
  --attribute-mapping email=email,name=name
```

### 2. Store Secrets in Secrets Manager

```bash
# Database password
aws secretsmanager create-secret \
  --name /global-gaming-platform/dev/database/password \
  --secret-string "your-secure-password"

# JWT secret
aws secretsmanager create-secret \
  --name /global-gaming-platform/dev/jwt/secret \
  --secret-string "your-jwt-secret-key"
```

### 3. Configure CloudWatch Alarms Email

```bash
# Confirm SNS subscription (check your email)
# Click the confirmation link sent to your alert_email
```

---

## Deployment Timeline

### First-Time Deployment
- **Duration:** 30-45 minutes
- **Steps:**
  1. Backend setup: 5 minutes
  2. Terraform init: 2 minutes
  3. Terraform plan: 3 minutes
  4. Terraform apply: 25-35 minutes
  5. Post-deployment config: 5 minutes

### Subsequent Deployments
- **Duration:** 10-20 minutes
- **Steps:**
  1. Terraform plan: 2 minutes
  2. Terraform apply: 8-18 minutes

---

## Cost Estimate

### Development Environment
- **VPC & Networking:** $50/month
- **ECS Fargate:** $100-150/month
- **RDS Aurora (t3.medium):** $80-120/month
- **DynamoDB:** $20-40/month
- **ElastiCache:** $50-80/month
- **CloudWatch & Logs:** $20-30/month
- **Other Services:** $30-50/month

**Total:** ~$350-520/month

### Production Environment
- **Estimated:** $600-990/month
- Higher instance types and redundancy

---

## Troubleshooting

### Issue: Terraform Init Fails

```bash
# Clear Terraform cache
rm -rf .terraform .terraform.lock.hcl

# Re-initialize
terraform init
```

### Issue: Resource Already Exists

```bash
# Import existing resource
terraform import module.network.aws_vpc.main vpc-xxxxx

# Or remove from state
terraform state rm module.network.aws_vpc.main
```

### Issue: Insufficient Permissions

```bash
# Check your IAM permissions
aws iam get-user

# Attach required policies
aws iam attach-user-policy \
  --user-name your-username \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

### Issue: State Lock

```bash
# If deployment was interrupted, unlock state
terraform force-unlock LOCK_ID

# Get LOCK_ID from error message
```

---

## Updating Infrastructure

### Making Changes

```bash
# 1. Update Terraform files
nano infrastructure/terraform/modules/network/main.tf

# 2. Plan changes
./scripts/deploy-terraform.sh dev plan

# 3. Review changes carefully
# Look for:
# - Resources being destroyed
# - Resources being recreated
# - Potential downtime

# 4. Apply changes
./scripts/deploy-terraform.sh dev apply
```

### Rolling Back Changes

```bash
# Option 1: Revert code and redeploy
git revert HEAD
./scripts/deploy-terraform.sh dev apply

# Option 2: Restore from state backup
aws s3 cp s3://global-gaming-platform-terraform-state-dev/dev/terraform.tfstate.backup \
  s3://global-gaming-platform-terraform-state-dev/dev/terraform.tfstate
```

---

## Destroying Infrastructure

**⚠️ WARNING: This will delete ALL resources!**

```bash
# Destroy development environment
./scripts/deploy-terraform.sh dev destroy

# Confirm by typing environment name when prompted
```

---

## Best Practices

### 1. Always Run Plan First
```bash
# Never skip the plan step
terraform plan -out=tfplan
# Review carefully before applying
```

### 2. Use Workspaces for Environments
```bash
# Create workspace
terraform workspace new dev

# Switch workspace
terraform workspace select dev

# List workspaces
terraform workspace list
```

### 3. Tag All Resources
```hcl
common_tags = {
  Project     = "global-gaming-platform"
  Environment = "dev"
  ManagedBy   = "Terraform"
  Owner       = "DevOps Team"
  CostCenter  = "Engineering"
}
```

### 4. Enable State Locking
- Always use S3 backend with DynamoDB locking
- Prevents concurrent modifications
- Protects against state corruption

### 5. Regular Backups
```bash
# Backup state file
aws s3 cp s3://global-gaming-platform-terraform-state-dev/dev/terraform.tfstate \
  ./backups/terraform.tfstate.$(date +%Y%m%d)
```

---

## Next Steps After Terraform Deployment

1. **Deploy Application Code**
   ```bash
   # Push code to GitHub to trigger CI/CD
   git push origin main
   ```

2. **Configure DNS**
   - Point your domain to ALB DNS name
   - Set up CloudFront distribution

3. **Run Smoke Tests**
   ```bash
   ./scripts/smoke-tests.sh
   ```

4. **Monitor Deployment**
   - Check CloudWatch dashboards
   - Verify all services are healthy
   - Test API endpoints

5. **Configure Monitoring Alerts**
   - Confirm SNS email subscriptions
   - Test PagerDuty integration
   - Verify Slack notifications

---

## Quick Reference

### Common Commands

```bash
# Plan
./scripts/deploy-terraform.sh dev plan

# Apply
./scripts/deploy-terraform.sh dev apply

# Destroy
./scripts/deploy-terraform.sh dev destroy

# Show outputs
cd infrastructure/terraform/environments/dev
terraform output

# Show state
terraform show

# List resources
terraform state list

# Refresh state
terraform refresh
```

### Important Outputs

```bash
# Get ALB DNS
terraform output alb_dns_name

# Get API Gateway URL
terraform output api_gateway_url

# Get Cognito User Pool ID
terraform output cognito_user_pool_id

# Get ECR Repository URL
terraform output ecr_repository_url
```

---

## Support

### Documentation
- Terraform Docs: https://www.terraform.io/docs
- AWS Provider Docs: https://registry.terraform.io/providers/hashicorp/aws/latest/docs

### Getting Help
- Check CloudWatch Logs
- Review Terraform state
- Contact DevOps team

---

**Last Updated:** November 8, 2025  
**Version:** 1.0.0
