# Final Diagnosis - Service Failures

## Root Causes Identified

### 1. Leaderboard Service - Database Password Missing
**Error**: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

**Root Cause**: The ECS task definition provides `DATABASE_SECRET_ARN` as a secret, but the service code expects individual environment variables:
- `DB_PASSWORD`
- `DB_USER`

**Current Terraform Config**:
```hcl
secrets = [
  {
    name      = "DATABASE_SECRET_ARN"
    valueFrom = var.database_secret_arn
  }
]
```

**What the Service Needs**:
```hcl
secrets = [
  {
    name      = "DB_PASSWORD"
    valueFrom = "${var.database_secret_arn}:password::"
  },
  {
    name      = "DB_USER"
    valueFrom = "${var.database_secret_arn}:username::"
  }
]
```

### 2. Auth Service - Cognito Not Deployed
**Error**: `Cannot read properties of undefined (reading 'userPoolId')`

**Root Cause**: The Terraform auth module (Cognito) hasn't been deployed. The auth service requires:
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `COGNITO_DOMAIN`
- `COGNITO_JWKS_URI`
- etc.

**Solution Options**:
1. Deploy Cognito via Terraform
2. Make auth service work without Cognito (mock/bypass mode)
3. Use existing Cognito from another project (not recommended)

### 3. Frontend - Unhealthy Status
**Status**: Running but marked unhealthy by ALB

**Possible Causes**:
- Health check configuration mismatch
- ALB target group checking wrong port/path
- Security group rules blocking health checks

## Immediate Fixes

### Fix 1: Update Terraform to Provide Individual DB Credentials

Edit `infrastructure/terraform/modules/ecs/services.tf`:

```hcl
# Leaderboard Service - Line ~375
secrets = [
  {
    name      = "DB_PASSWORD"
    valueFrom = "${var.database_secret_arn}:password::"
  },
  {
    name      = "DB_USER"
    valueFrom = "${var.database_secret_arn}:username::"
  }
]
```

Then apply:
```bash
cd infrastructure/terraform/environments/dev
terraform apply -target=module.ecs.aws_ecs_task_definition.leaderboard_service
```

### Fix 2: Deploy Cognito Resources

Check if Cognito module is in Terraform:
```bash
cd infrastructure/terraform/environments/dev
terraform state list | grep cognito
```

If not present, the auth module needs to be added to `main.tf`:
```hcl
module "auth" {
  source = "../../modules/auth"
  
  project_name = var.project_name
  environment  = var.environment
  # ... other variables
}
```

Then apply:
```bash
terraform apply -target=module.auth
```

### Fix 3: Check Frontend Health

```bash
# Get target group
TG_ARN=$(aws elbv2 describe-target-groups \
  --region eu-west-2 \
  --query 'TargetGroups[?contains(TargetGroupName, `frontend`)].TargetGroupArn' \
  --output text)

# Check health
aws elbv2 describe-target-health \
  --target-group-arn $TG_ARN \
  --region eu-west-2

# Fix health check if needed
aws elbv2 modify-target-group \
  --target-group-arn $TG_ARN \
  --health-check-protocol HTTP \
  --health-check-port 8080 \
  --health-check-path /health \
  --region eu-west-2
```

## Quick Workaround (Without Terraform Changes)

If you can't modify Terraform right now, manually update the task definitions:

### Update Leaderboard Service

1. Get the database secret ARN:
```bash
aws secretsmanager list-secrets --region eu-west-2 \
  --query 'SecretList[?contains(Name, `aurora`) || contains(Name, `database`)].ARN' \
  --output text
```

2. Register new task definition with proper secrets:
```bash
# Get current task definition
aws ecs describe-task-definition \
  --task-definition global-gaming-platform-leaderboard-service \
  --region eu-west-2 \
  --query 'taskDefinition' > /tmp/task-def.json

# Edit the JSON to add secrets (manual step)
# Then register:
aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-updated.json \
  --region eu-west-2

# Force new deployment
aws ecs update-service \
  --cluster global-gaming-platform-cluster \
  --service global-gaming-platform-leaderboard-service \
  --force-new-deployment \
  --region eu-west-2
```

### Disable Auth Service Temporarily

If Cognito isn't critical right now, you can:

1. Scale auth service to 0:
```bash
aws ecs update-service \
  --cluster global-gaming-platform-cluster \
  --service global-gaming-platform-auth-service \
  --desired-count 0 \
  --region eu-west-2
```

2. Focus on getting game-engine, leaderboard, and frontend working first

## Recommended Approach

1. **Fix Terraform configuration** for leaderboard service secrets
2. **Apply Terraform changes** to update task definition
3. **Deploy Cognito** via Terraform or disable auth service
4. **Fix frontend health check** configuration
5. **Rebuild and redeploy** services with correct configuration

The core issue is that your Terraform infrastructure is partially deployed - the database exists but the secrets aren't being passed correctly to the services, and Cognito hasn't been deployed at all.
