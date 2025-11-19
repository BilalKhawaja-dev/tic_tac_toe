# Pre-Deployment Checklist

## What Failed in Previous AWS Deployment

### 1. ❌ Auth Service - Missing Middleware Files
**Error**: `Cannot find module './middleware/errorHandler'`
**Root Cause**: Missing middleware files that were referenced but not created
**Files Missing**:
- `src/auth-service/src/middleware/errorHandler.js`
- `src/auth-service/src/middleware/requestLogger.js`
- `src/auth-service/src/middleware/validation.js`

**Status**: ✅ FIXED - All files created

### 2. ❌ Auth Service - Missing Cognito Configuration
**Error**: `Cannot read properties of undefined (reading 'userPoolId')`
**Root Cause**: Config file missing `cognito` section
**Impact**: Service crashed on startup

**Status**: ✅ FIXED - Added cognito config section

### 3. ❌ Leaderboard Service - Database Password Type Error
**Error**: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`
**Root Cause**: DB_PASSWORD environment variable not properly typed
**Impact**: Could not connect to PostgreSQL

**Status**: ✅ FIXED in code, ⚠️ NEEDS TERRAFORM UPDATE

### 4. ❌ Frontend - Unhealthy Status
**Error**: ALB health checks failing
**Root Cause**: Health check configuration mismatch
**Impact**: Service running but marked unhealthy

**Status**: ⏳ NEEDS INVESTIGATION

### 5. ❌ Terraform - ECS Task Definitions Wrong
**Error**: Services expecting individual env vars but getting secret ARN
**Root Cause**: Task definitions provide `DATABASE_SECRET_ARN` but services need `DB_PASSWORD`, `DB_USER`
**Impact**: Services can't access database credentials

**Status**: ⚠️ NEEDS TERRAFORM FIX

### 6. ❌ Terraform - Cognito Not Deployed
**Error**: Auth service references Cognito resources that don't exist
**Root Cause**: Cognito module not included in Terraform deployment
**Impact**: Auth service can't function

**Status**: ⚠️ NEEDS TERRAFORM FIX

---

## Tasks to Complete Before Redeployment

### Phase 1: Local Testing (CURRENT PHASE)

#### 1.1 Start Local Environment
```bash
docker-compose up --build -d
```

**Verify**:
- [ ] PostgreSQL starts and is healthy
- [ ] Redis starts and is healthy
- [ ] All 4 services build successfully
- [ ] No build errors in logs

#### 1.2 Test Each Service Individually

**Game Engine** (Port 3000):
- [ ] Service starts without errors
- [ ] Health endpoint responds: `curl http://localhost:3000/health`
- [ ] Can create a game
- [ ] Can make moves
- [ ] WebSocket connections work

**Auth Service** (Port 3001):
- [ ] Service starts without errors
- [ ] Health endpoint responds: `curl http://localhost:3001/health`
- [ ] Config endpoint works: `curl http://localhost:3001/api/auth/config`
- [ ] Token validation endpoint accessible
- [ ] No Cognito errors (should use mock config)

**Leaderboard Service** (Port 3002):
- [ ] Service starts without errors
- [ ] Health endpoint responds: `curl http://localhost:3002/health`
- [ ] Can connect to PostgreSQL
- [ ] Can connect to Redis
- [ ] Can fetch leaderboard data

**Frontend** (Port 8080):
- [ ] Nginx starts successfully
- [ ] Health endpoint responds: `curl http://localhost:8080/health`
- [ ] Homepage loads in browser
- [ ] Can navigate to all pages
- [ ] No console errors

#### 1.3 Test Integration

- [ ] Frontend can call game engine API
- [ ] Frontend can call auth service API
- [ ] Frontend can call leaderboard API
- [ ] Services can communicate with each other
- [ ] Database schema is created correctly
- [ ] Redis caching works

#### 1.4 Run Automated Tests

```bash
# Auth service tests
docker-compose exec auth-service npm test

# Leaderboard service tests
docker-compose exec leaderboard-service npm test

# Game engine tests
docker-compose exec game-engine npm test

# Frontend tests
docker-compose exec frontend npm test
```

**Verify**:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No test failures

#### 1.5 Fix Any Issues Found

Document and fix any issues discovered during local testing:
- [ ] Code bugs fixed
- [ ] Configuration issues resolved
- [ ] Dependencies updated if needed
- [ ] Tests updated if needed

---

### Phase 2: Terraform Configuration Updates

#### 2.1 Fix ECS Task Definitions

**File**: `infrastructure/terraform/modules/ecs/services.tf`

**Auth Service** (Line ~90):
```hcl
secrets = [
  {
    name      = "DB_PASSWORD"
    valueFrom = "${var.database_secret_arn}:password::"
  },
  {
    name      = "DB_USER"
    valueFrom = "${var.database_secret_arn}:username::"
  },
  {
    name      = "COGNITO_USER_POOL_ID"
    valueFrom = "${var.cognito_secret_arn}:user_pool_id::"
  },
  {
    name      = "COGNITO_CLIENT_ID"
    valueFrom = "${var.cognito_secret_arn}:client_id::"
  },
  {
    name      = "COGNITO_CLIENT_SECRET"
    valueFrom = "${var.cognito_secret_arn}:client_secret::"
  }
]
```

**Leaderboard Service** (Line ~375):
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

**Game Engine** (Line ~257):
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

**Tasks**:
- [ ] Update auth-service task definition
- [ ] Update leaderboard-service task definition
- [ ] Update game-engine task definition
- [ ] Add required variables to `variables.tf`

#### 2.2 Deploy Cognito Resources

**File**: `infrastructure/terraform/environments/dev/main.tf`

Check if auth module is included:
```hcl
module "auth" {
  source = "../../modules/auth"
  
  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.network.vpc_id
  
  # Add other required variables
}
```

**Tasks**:
- [ ] Verify auth module exists in `modules/auth/`
- [ ] Add auth module to `main.tf` if missing
- [ ] Configure auth module variables
- [ ] Create Cognito user pool
- [ ] Create Cognito app client
- [ ] Store Cognito credentials in Secrets Manager

#### 2.3 Fix Frontend Health Checks

**File**: `infrastructure/terraform/modules/ecs/main.tf`

Update frontend target group health check:
```hcl
health_check {
  enabled             = true
  healthy_threshold   = 2
  unhealthy_threshold = 3
  timeout             = 5
  interval            = 30
  path                = "/health"
  port                = "8080"
  protocol            = "HTTP"
  matcher             = "200"
}
```

**Tasks**:
- [ ] Update frontend target group health check
- [ ] Verify health check path is `/health`
- [ ] Verify health check port is `8080`
- [ ] Set appropriate thresholds

#### 2.4 Add Missing Variables

**File**: `infrastructure/terraform/modules/ecs/variables.tf`

Add:
```hcl
variable "cognito_secret_arn" {
  description = "ARN of Cognito credentials secret"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito App Client ID"
  type        = string
}
```

**Tasks**:
- [ ] Add cognito_secret_arn variable
- [ ] Add cognito_user_pool_id variable
- [ ] Add cognito_client_id variable
- [ ] Pass variables from main.tf

#### 2.5 Update Outputs

**File**: `infrastructure/terraform/environments/dev/outputs.tf`

Add:
```hcl
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito App Client ID"
  value       = module.auth.client_id
}

output "cognito_domain" {
  description = "Cognito Domain"
  value       = module.auth.domain
}
```

**Tasks**:
- [ ] Add Cognito outputs
- [ ] Verify outputs are accessible
- [ ] Document outputs for deployment

---

### Phase 3: Pre-Deployment Validation

#### 3.1 Terraform Validation

```bash
cd infrastructure/terraform/environments/dev

# Format
terraform fmt -recursive

# Validate
terraform validate

# Plan
terraform plan -out=tfplan
```

**Verify**:
- [ ] No syntax errors
- [ ] No validation errors
- [ ] Plan shows expected changes
- [ ] No unexpected resource deletions

#### 3.2 Docker Images

```bash
# Build all images locally
docker-compose build

# Test images
docker-compose up -d
docker-compose ps
docker-compose logs
```

**Verify**:
- [ ] All images build successfully
- [ ] No build warnings
- [ ] Images are optimized (reasonable size)
- [ ] All dependencies included

#### 3.3 Security Review

- [ ] No secrets in code
- [ ] Environment variables properly configured
- [ ] Secrets Manager used for sensitive data
- [ ] IAM roles have minimum required permissions
- [ ] Security groups properly configured
- [ ] No public database access

#### 3.4 Cost Estimation

```bash
# Use Infracost or manual estimation
terraform plan -out=tfplan
```

**Estimate**:
- [ ] ECS Fargate costs
- [ ] RDS Aurora costs
- [ ] ElastiCache costs
- [ ] ALB costs
- [ ] NAT Gateway costs
- [ ] Data transfer costs

**Expected**: ~$230-400/day for dev environment

---

### Phase 4: Deployment Strategy

#### 4.1 Deployment Order

1. **Infrastructure First**:
   - [ ] VPC and networking
   - [ ] Security groups
   - [ ] RDS Aurora cluster
   - [ ] ElastiCache Redis
   - [ ] Secrets Manager secrets

2. **Auth Resources**:
   - [ ] Cognito User Pool
   - [ ] Cognito App Client
   - [ ] Store credentials in Secrets Manager

3. **Container Infrastructure**:
   - [ ] ECR repositories
   - [ ] ECS cluster
   - [ ] ALB and target groups

4. **Services**:
   - [ ] Build and push Docker images
   - [ ] Deploy game-engine service
   - [ ] Deploy leaderboard service
   - [ ] Deploy auth service
   - [ ] Deploy frontend

#### 4.2 Rollback Plan

If deployment fails:
```bash
# Rollback Terraform
terraform apply tfplan.backup

# Or destroy and start over
terraform destroy -auto-approve
```

**Prepare**:
- [ ] Backup current Terraform state
- [ ] Document rollback procedure
- [ ] Have destroy script ready

#### 4.3 Monitoring Setup

- [ ] CloudWatch dashboards configured
- [ ] Alarms set up for critical metrics
- [ ] Log groups created
- [ ] X-Ray tracing enabled

---

## Summary Checklist

### Code Fixes
- [x] Auth service middleware files created
- [x] Auth service config updated with Cognito section
- [x] Leaderboard service DB password handling fixed
- [x] Docker Compose configuration updated

### Terraform Fixes Needed
- [ ] ECS task definitions updated with individual secrets
- [ ] Cognito module deployed
- [ ] Frontend health checks fixed
- [ ] Variables and outputs updated

### Testing Required
- [ ] Local testing complete
- [ ] All services start successfully
- [ ] Integration tests pass
- [ ] No errors in logs

### Pre-Deployment
- [ ] Terraform validated
- [ ] Docker images built and tested
- [ ] Security review complete
- [ ] Cost estimation done
- [ ] Deployment plan documented
- [ ] Rollback plan ready

---

## Next Actions

1. **Start local testing**: `docker-compose up --build -d`
2. **Fix any issues found** during local testing
3. **Update Terraform** with fixes documented above
4. **Validate Terraform**: `terraform validate && terraform plan`
5. **Deploy to AWS** when all checks pass

## Success Criteria

Before redeploying to AWS, ensure:
- ✅ All services run successfully locally
- ✅ All tests pass
- ✅ No errors in logs
- ✅ Terraform plan shows expected changes
- ✅ Security review complete
- ✅ Cost estimation acceptable
- ✅ Rollback plan documented
