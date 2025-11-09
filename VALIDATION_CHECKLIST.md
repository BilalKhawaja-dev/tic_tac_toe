# Infrastructure Validation Checklist

## Pre-Deployment Validation

### ✅ Module Outputs Validation
Run this to verify all outputs exist:

```bash
# Check each module has required outputs
grep -r "output.*arn" infrastructure/terraform/modules/*/outputs.tf | wc -l
# Should show 50+ outputs

# Verify specific critical outputs
grep "kms_key_arn" infrastructure/terraform/modules/security/outputs.tf
grep "database_security_group_id" infrastructure/terraform/modules/network/outputs.tf
grep "critical_sns_topic_arn" infrastructure/terraform/modules/monitoring/outputs.tf
grep "aurora_cluster_endpoint" infrastructure/terraform/modules/database/outputs.tf
grep "cluster_name" infrastructure/terraform/modules/ecs/outputs.tf
```

### ⚠️ Known Issues to Fix

**ECS Module - Line 426**
```bash
# Check the error
terraform -chdir=infrastructure/terraform/environments/dev validate 2>&1 | grep -A 3 "deployment_configuration"

# Expected error:
# Error: Unsupported block type
#   on ../../modules/ecs/main.tf line 426
#   deployment_configuration {
```

**Fix**: Review `infrastructure/terraform/modules/ecs/main.tf` around line 426

### ✅ Configuration Validation

```bash
# Verify terraform.tfvars exists
test -f infrastructure/terraform/environments/dev/terraform.tfvars && echo "✅ tfvars exists" || echo "❌ Create from .example"

# Verify AWS credentials
aws sts get-caller-identity && echo "✅ AWS credentials valid" || echo "❌ Configure AWS CLI"

# Verify Terraform version
terraform version | grep "v1.5" && echo "✅ Terraform 1.5.x" || echo "⚠️ Check version"
```

## Post-Fix Validation

### Step 1: Terraform Validate
```bash
cd infrastructure/terraform/environments/dev
terraform init
terraform validate

# Expected output:
# Success! The configuration is valid.
```

### Step 2: Terraform Plan
```bash
terraform plan -out=phase1.tfplan

# Should show:
# Plan: ~150 to add, 0 to change, 0 to destroy
```

### Step 3: Check Plan Output
```bash
# Verify key resources will be created
terraform show phase1.tfplan | grep -E "will be created|module\."

# Should include:
# - module.network
# - module.security
# - module.database
# - module.monitoring
# - module.ecs
# - module.appconfig
```

## Deployment Validation

### During Deployment
```bash
# Monitor deployment progress
terraform apply phase1.tfplan

# Watch for:
# - VPC creation (2-3 min)
# - Security groups (1-2 min)
# - Aurora cluster (15-20 min)
# - DynamoDB tables (2-3 min)
# - ECS cluster (5-10 min)
# - Total time: 30-40 min
```

### Post-Deployment Checks

```bash
# 1. Verify VPC
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=global-gaming-platform" --region eu-west-2

# 2. Verify Aurora cluster
aws rds describe-db-clusters --region eu-west-2 | grep "global-gaming-platform"

# 3. Verify DynamoDB tables
aws dynamodb list-tables --region eu-west-2 | grep "global-gaming-platform"

# 4. Verify ECS cluster
aws ecs list-clusters --region eu-west-2 | grep "global-gaming-platform"

# 5. Verify S3 buckets
aws s3 ls | grep "global-gaming-platform"

# 6. Check CloudWatch dashboards
aws cloudwatch list-dashboards --region eu-west-2 | grep "global-gaming-platform"
```

### Health Checks

```bash
# Get ALB DNS name
terraform output alb_dns_name

# Check ALB health
curl -I http://$(terraform output -raw alb_dns_name)/health

# Expected: HTTP 200 or 503 (503 is OK if services not deployed yet)
```

## Module-Specific Validation

### Network Module
```bash
# Verify subnets created
aws ec2 describe-subnets --filters "Name=tag:Project,Values=global-gaming-platform" --region eu-west-2 | jq '.Subnets | length'
# Expected: 9 subnets (3 AZs × 3 types)

# Verify security groups
aws ec2 describe-security-groups --filters "Name=tag:Project,Values=global-gaming-platform" --region eu-west-2 | jq '.SecurityGroups | length'
# Expected: 7+ security groups
```

### Security Module
```bash
# Verify KMS keys
aws kms list-aliases --region eu-west-2 | grep "global-gaming-platform"
# Expected: 3 keys (main, rds, s3)

# Verify secrets
aws secretsmanager list-secrets --region eu-west-2 | grep "global-gaming-platform"
# Expected: 4 secrets (database, redis, jwt, oauth)

# Verify S3 buckets
aws s3 ls | grep "global-gaming-platform"
# Expected: 2 buckets (cloudtrail, user-content)
```

### Database Module
```bash
# Verify Aurora
aws rds describe-db-clusters --region eu-west-2 --query 'DBClusters[?contains(DBClusterIdentifier, `global-gaming-platform`)].Status'
# Expected: ["available"]

# Verify DynamoDB tables
aws dynamodb describe-table --table-name global-gaming-platform-games --region eu-west-2 | jq '.Table.TableStatus'
# Expected: "ACTIVE"

# Verify ElastiCache
aws elasticache describe-replication-groups --region eu-west-2 | grep "global-gaming-platform"
# Expected: Redis cluster

# Verify DAX
aws dax describe-clusters --region eu-west-2 | grep "global-gaming-platform"
# Expected: DAX cluster
```

### Monitoring Module
```bash
# Verify CloudWatch log groups
aws logs describe-log-groups --region eu-west-2 | grep "global-gaming-platform" | wc -l
# Expected: 6+ log groups

# Verify SNS topics
aws sns list-topics --region eu-west-2 | grep "global-gaming-platform" | wc -l
# Expected: 3 topics (critical, warning, info)

# Verify CloudWatch alarms
aws cloudwatch describe-alarms --region eu-west-2 | grep "global-gaming-platform" | wc -l
# Expected: 10+ alarms
```

### ECS Module
```bash
# Verify ECS cluster
aws ecs describe-clusters --clusters global-gaming-platform-cluster --region eu-west-2 | jq '.clusters[0].status'
# Expected: "ACTIVE"

# Verify ECR repository
aws ecr describe-repositories --region eu-west-2 | grep "global-gaming-platform"
# Expected: game-engine repository

# Verify ALB
aws elbv2 describe-load-balancers --region eu-west-2 | grep "global-gaming-platform"
# Expected: Application Load Balancer
```

## Troubleshooting

### If Validation Fails

**Error: Missing outputs**
```bash
# Check which module is missing outputs
terraform -chdir=infrastructure/terraform/environments/dev validate 2>&1 | grep "Unsupported attribute"

# Read the module outputs file
cat infrastructure/terraform/modules/<module>/outputs.tf
```

**Error: Resource argument not supported**
```bash
# Check Terraform AWS provider version
terraform version

# Check resource documentation
# https://registry.terraform.io/providers/hashicorp/aws/latest/docs
```

**Error: Circular dependency**
```bash
# Check module dependencies
terraform -chdir=infrastructure/terraform/environments/dev graph | dot -Tpng > graph.png

# Review the graph for cycles
```

### If Deployment Fails

**Aurora creation timeout**
- Normal: Aurora can take 15-20 minutes
- Check CloudWatch logs for errors
- Verify subnet group and security group exist

**DynamoDB creation fails**
- Check table names don't already exist
- Verify IAM permissions
- Check region settings

**ECS service won't start**
- Check task definition is valid
- Verify ECR repository exists
- Check security group allows traffic
- Review CloudWatch logs

## Success Criteria

- [ ] `terraform validate` passes with no errors
- [ ] `terraform plan` shows expected resources (~150)
- [ ] `terraform apply` completes successfully
- [ ] All AWS resources are created
- [ ] CloudWatch dashboards are accessible
- [ ] Aurora cluster is available
- [ ] DynamoDB tables are active
- [ ] ECS cluster is running
- [ ] ALB health check responds
- [ ] No errors in CloudWatch logs

## Next Steps After Validation

1. ✅ Infrastructure validated and deployed
2. 📋 Implement Task 11: Security Hardening
3. 📋 Implement Task 12: Disaster Recovery
4. 📋 Implement Task 13: Performance Optimization
5. 📋 Implement Task 14: Final Testing
6. 🚀 Deploy Phase 2 (Auth, API Gateway, CI/CD)

---

**Last Updated**: Current Session  
**Status**: Ready for validation after ECS fix  
**Estimated Fix Time**: 5-10 minutes
