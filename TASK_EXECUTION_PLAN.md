# Task Execution Plan

## Current Status: Ready for Local Testing

All code fixes are complete. Now we need to test locally, fix Terraform, then redeploy.

---

## Phase 1: Local Testing & Validation (START HERE)

### Task 1.1: Start Local Environment
```bash
# Clean any existing containers
docker-compose down -v

# Start fresh
docker-compose up --build -d

# Watch logs
docker-compose logs -f
```

**Expected**: All 4 services + PostgreSQL + Redis start successfully

**If fails**: Check logs, fix issues, rebuild

---

### Task 1.2: Verify Database & Cache

```bash
# Check PostgreSQL
docker-compose exec postgres psql -U postgres -d gaming_platform -c "\dt"

# Check Redis
docker-compose exec redis redis-cli ping
```

**Expected**: 
- PostgreSQL shows tables
- Redis responds with PONG

---

### Task 1.3: Test Each Service Health

```bash
# Game Engine
curl http://localhost:3000/health

# Auth Service  
curl http://localhost:3001/health

# Leaderboard
curl http://localhost:3002/health

# Frontend
curl http://localhost:8080/health
```

**Expected**: All return 200 OK with health status

**If fails**: Check service logs, fix configuration

---

### Task 1.4: Test Frontend in Browser

```bash
open http://localhost:8080
```

**Check**:
- [ ] Homepage loads
- [ ] No console errors
- [ ] Can navigate to Game page
- [ ] Can navigate to Leaderboard page
- [ ] Can navigate to Support page

---

### Task 1.5: Test API Integration

```bash
# Test game creation
curl -X POST http://localhost:3000/api/games \
  -H "Content-Type: application/json" \
  -d '{"playerId": "test-player"}'

# Test leaderboard
curl http://localhost:3002/api/leaderboard/global

# Test auth config
curl http://localhost:3001/api/auth/config
```

**Expected**: All APIs respond correctly

---

### Task 1.6: Run Automated Tests

```bash
# Auth service
docker-compose exec auth-service npm test

# Leaderboard service
docker-compose exec leaderboard-service npm test

# Game engine
docker-compose exec game-engine npm test
```

**Expected**: All tests pass

**If fails**: Fix failing tests, update code

---

## Phase 2: Fix Terraform Configuration

### Task 2.1: Update ECS Task Definitions

**File**: `infrastructure/terraform/modules/ecs/services.tf`

Update secrets for all three services (auth, leaderboard, game-engine) to use individual secret keys instead of full ARN.

**Action**: I'll create the updated file

---

### Task 2.2: Add Cognito Module

**Check**: Does `infrastructure/terraform/modules/auth/` exist?

**If yes**: Verify it's configured correctly
**If no**: Need to create or enable it

**Action**: I'll check and update

---

### Task 2.3: Fix Frontend Health Checks

**File**: `infrastructure/terraform/modules/ecs/main.tf`

Update frontend target group health check configuration.

**Action**: I'll update the file

---

### Task 2.4: Add Missing Variables

**File**: `infrastructure/terraform/modules/ecs/variables.tf`

Add Cognito-related variables.

**Action**: I'll update the file

---

### Task 2.5: Validate Terraform

```bash
cd infrastructure/terraform/environments/dev
terraform fmt -recursive
terraform validate
terraform plan
```

**Expected**: No errors, plan shows expected changes

---

## Phase 3: Prepare for Deployment

### Task 3.1: Build Production Images

```bash
# Test production builds locally
docker-compose -f docker-compose.prod.yml build
```

**Expected**: All images build successfully

---

### Task 3.2: Security Review

Review:
- [ ] No hardcoded secrets
- [ ] Proper IAM roles
- [ ] Security groups configured
- [ ] Secrets Manager used

---

### Task 3.3: Cost Estimation

Estimate monthly costs:
- ECS Fargate: ~$1,500-3,000
- RDS Aurora: ~$3,000-6,000
- ElastiCache: ~$900-1,500
- ALB: ~$600
- NAT Gateway: ~$900
- **Total**: ~$6,900-12,000/month

---

### Task 3.4: Create Deployment Script

Script to:
1. Build images
2. Push to ECR
3. Apply Terraform
4. Verify deployment

---

## Phase 4: Deploy to AWS

### Task 4.1: Deploy Infrastructure

```bash
cd infrastructure/terraform/environments/dev
terraform apply
```

**Monitor**: Watch for errors, verify resources created

---

### Task 4.2: Build & Push Images

```bash
./scripts/build-and-push-all-services.sh
```

**Verify**: Images in ECR

---

### Task 4.3: Deploy Services

```bash
./scripts/deploy-all-services.sh
```

**Monitor**: Watch ECS service deployments

---

### Task 4.4: Verify Deployment

```bash
# Get ALB URL
ALB_URL=$(terraform output -raw alb_dns_name)

# Test services
curl http://$ALB_URL/health
curl http://$ALB_URL/api/auth/health
curl http://$ALB_URL/api/leaderboard/health
curl http://$ALB_URL/api/game/health
```

---

### Task 4.5: Monitor & Validate

- [ ] Check CloudWatch logs
- [ ] Verify all services healthy
- [ ] Test application functionality
- [ ] Monitor for errors

---

## Rollback Plan

If deployment fails:

```bash
# Option 1: Rollback Terraform
cd infrastructure/terraform/environments/dev
terraform apply tfplan.backup

# Option 2: Destroy and start over
./scripts/cleanup-ecr-and-destroy.sh
```

---

## Current Priority: Phase 1

**Start with**: Local testing to ensure all services work correctly

**Command**:
```bash
docker-compose up --build -d
docker-compose logs -f
```

Once local testing passes, we'll move to Phase 2 (Terraform fixes).
