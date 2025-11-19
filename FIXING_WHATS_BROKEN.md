# Fixing What's Broken - Action Plan

## Status: IN PROGRESS

### ✅ Step 1: Code Verification (COMPLETE)
- Verified all middleware files exist
- Checked exports match imports
- Ran diagnostics - no syntax errors
- **Result**: Code changes are syntactically correct

### ✅ Step 2: Terraform Fixes - ECS Secrets (COMPLETE)

#### Fix 2.1: ECS Task Definitions - Database Secrets ✅
**Problem**: Services get `DATABASE_SECRET_ARN` but need `DB_PASSWORD` and `DB_USER`

**Files Updated**:
1. ✅ `infrastructure/terraform/modules/ecs/services.tf` (auth-service) - Fixed
2. ✅ `infrastructure/terraform/modules/ecs/services.tf` (leaderboard-service) - Fixed
3. ✅ `infrastructure/terraform/modules/ecs/main.tf` (game-engine) - Fixed
4. ✅ `infrastructure/terraform/modules/ecs/variables.tf` - Added cognito_secret_arn variable

**Changes Made**:
- Auth service now gets: `DB_PASSWORD`, `DB_USER`, `JWT_SECRET`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`
- Leaderboard service now gets: `DB_PASSWORD`, `DB_USER`
- Game engine now gets: `DB_PASSWORD`, `DB_USER`, `REDIS_PASSWORD`, `JWT_SECRET`

### ✅ Step 3: Frontend Health Check (VERIFIED - NO FIX NEEDED)

**Status**: Health check configuration is CORRECT
- Target group checks `/health` on port 8080 ✅
- Nginx has `/health` endpoint that returns 200 ✅
- Health check thresholds are reasonable ✅

**Conclusion**: Frontend health check was not actually broken in Terraform. The unhealthy status in AWS was likely due to:
1. Missing environment variables (now fixed)
2. Service not starting properly (code fixes should resolve)
3. Or temporary deployment issues

### ✅ Step 4: Summary of All Fixes

**Code Fixes** (Already Done):
1. ✅ Created auth-service middleware files (errorHandler, requestLogger, validation)
2. ✅ Added Cognito config section to auth-service
3. ✅ Fixed DB password handling in leaderboard-service

**Terraform Fixes** (Just Completed):
1. ✅ Fixed auth-service secrets (DB_PASSWORD, DB_USER, Cognito credentials)
2. ✅ Fixed leaderboard-service secrets (DB_PASSWORD, DB_USER)
3. ✅ Fixed game-engine secrets (DB_PASSWORD, DB_USER, REDIS_PASSWORD)
4. ✅ Added cognito_secret_arn variable
5. ✅ Verified frontend health check (was already correct)

### ⏳ Step 5: What's Still Needed

**Before Redeployment**:
1. ❌ Test locally with Docker Compose (verify code fixes work)
2. ❌ Deploy or configure Cognito resources
3. ❌ Create Cognito secret in Secrets Manager
4. ❌ Validate Terraform configuration (`terraform validate`)
5. ❌ Review Terraform plan (`terraform plan`)

**Deployment**:
1. ❌ Apply Terraform changes
2. ❌ Build and push Docker images
3. ❌ Deploy services to ECS
4. ❌ Monitor and verify

### 🎯 NEXT ACTIONS

**Option A - Test Locally First** (Recommended):
```bash
docker-compose up --build -d
docker-compose logs -f
# Fix any issues found
# Then proceed to AWS deployment
```

**Option B - Deploy to AWS Directly**:
```bash
cd infrastructure/terraform/environments/dev
terraform validate
terraform plan
terraform apply
# Then build and push images
# Then deploy services
```
