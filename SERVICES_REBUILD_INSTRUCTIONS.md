# Services Rebuild Instructions

## Issues Fixed

### 1. Auth Service - Missing Middleware Files
**Error**: `Cannot find module './middleware/errorHandler'`

**Files Created**:
- `src/auth-service/src/middleware/errorHandler.js` - Error handling middleware
- `src/auth-service/src/middleware/requestLogger.js` - Request logging middleware
- `src/auth-service/src/middleware/validation.js` - Request validation middleware (already created)

### 2. Leaderboard Service - Database Password Type Error
**Error**: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

**Fix Applied**: Updated `src/leaderboard-service/src/config/index.js` to ensure DB_PASSWORD is always a string.

**Note**: The issue persists because the old Docker image is still running. Need to rebuild and redeploy.

### 3. Frontend - Unhealthy Status
**Status**: Frontend is running but marked as unhealthy by ALB health checks.

**Possible Causes**:
- Health check endpoint misconfiguration
- ALB target group health check settings
- Port mismatch between container and health check

## Deployment Steps

### Step 1: Re-authenticate with AWS

Your AWS credentials have expired. Re-authenticate:

```bash
aws configure
# Or if using SSO:
aws sso login --profile your-profile
```

### Step 2: Run the Rebuild Script

```bash
export AWS_REGION=eu-west-2
./scripts/rebuild-broken-services.sh
```

This script will:
1. ✅ Login to ECR
2. ✅ Build auth-service with all middleware files
3. ✅ Build leaderboard-service with fixed DB config
4. ✅ Push both images to ECR
5. ✅ Force new ECS deployments
6. ✅ Wait for services to stabilize
7. ✅ Display final status

### Step 3: Monitor Deployment

Watch the logs in real-time:

```bash
# Auth service logs
aws logs tail /ecs/global-gaming-platform-auth-service --follow --region eu-west-2

# Leaderboard service logs
aws logs tail /ecs/global-gaming-platform-leaderboard-service --follow --region eu-west-2
```

### Step 4: Verify Services

Check service health:

```bash
aws ecs describe-services \
  --cluster global-gaming-platform-cluster \
  --services \
    global-gaming-platform-auth-service \
    global-gaming-platform-leaderboard-service \
    global-gaming-platform-frontend \
    global-gaming-platform-game-engine \
  --region eu-west-2 \
  --query 'services[*].[serviceName,status,runningCount,desiredCount,healthCheckGracePeriodSeconds]' \
  --output table
```

## Expected Results

### Auth Service Logs
```
Using environment variables for configuration
Auth Service started on port 3001
✓ Connected to Cognito
✓ JWT Service initialized
✓ All middleware loaded
Server listening on port 3001
```

### Leaderboard Service Logs
```
Initializing Leaderboard Service...
✓ Connected to PostgreSQL database
✓ Connected to Redis cache
✓ RankingManager initialized
Leaderboard Service started on port 3002
```

## Frontend Health Check Issue

The frontend is running but showing as unhealthy. Check:

### 1. Target Group Health Check Settings

```bash
# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups \
  --region eu-west-2 \
  --query 'TargetGroups[?contains(TargetGroupName, `frontend`)].TargetGroupArn' \
  --output text)

# Check health check configuration
aws elbv2 describe-target-groups \
  --target-group-arns $TG_ARN \
  --region eu-west-2 \
  --query 'TargetGroups[0].[HealthCheckProtocol,HealthCheckPort,HealthCheckPath,HealthCheckIntervalSeconds,HealthyThresholdCount,UnhealthyThresholdCount,Matcher]' \
  --output table
```

### 2. Check Target Health

```bash
aws elbv2 describe-target-health \
  --target-group-arn $TG_ARN \
  --region eu-west-2 \
  --output table
```

### 3. Common Issues

**Issue**: Health check path mismatch
- Frontend nginx listens on port 8080
- Health check endpoint is `/health`
- Verify ALB target group is checking `HTTP:8080/health`

**Issue**: Health check timeout
- Frontend might be slow to respond
- Increase health check timeout or interval

**Issue**: Security group rules
- Ensure ALB security group can reach ECS tasks on port 8080

### 4. Fix Health Check (if needed)

```bash
# Update target group health check
aws elbv2 modify-target-group \
  --target-group-arn $TG_ARN \
  --health-check-protocol HTTP \
  --health-check-port 8080 \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --matcher HttpCode=200 \
  --region eu-west-2
```

## Database Connection Issue

If leaderboard service still has database connection issues after rebuild:

### 1. Check if DB_PASSWORD is set in ECS task definition

```bash
aws ecs describe-task-definition \
  --task-definition global-gaming-platform-leaderboard-service \
  --region eu-west-2 \
  --query 'taskDefinition.containerDefinitions[0].[environment,secrets]' \
  --output json
```

### 2. Verify database credentials in Secrets Manager

```bash
# List secrets
aws secretsmanager list-secrets \
  --region eu-west-2 \
  --query 'SecretList[?contains(Name, `gaming`) || contains(Name, `db`)].Name' \
  --output table

# Get secret value (replace with actual secret name)
aws secretsmanager get-secret-value \
  --secret-id your-db-secret-name \
  --region eu-west-2 \
  --query SecretString \
  --output text
```

### 3. Update ECS task definition with correct secret

If DB_PASSWORD is not set or incorrect, update the task definition to pull from Secrets Manager:

```json
{
  "name": "DB_PASSWORD",
  "valueFrom": "arn:aws:secretsmanager:eu-west-2:981686514879:secret:your-db-secret:password::"
}
```

## Summary

**Files Modified**:
- ✅ `src/auth-service/src/middleware/errorHandler.js` (created)
- ✅ `src/auth-service/src/middleware/requestLogger.js` (created)
- ✅ `src/auth-service/src/middleware/validation.js` (created)
- ✅ `src/leaderboard-service/src/config/index.js` (modified)

**Next Steps**:
1. Re-authenticate with AWS
2. Run `./scripts/rebuild-broken-services.sh`
3. Monitor CloudWatch logs
4. Fix frontend health check if needed
5. Verify database credentials for leaderboard service

**Cluster Info**:
- Cluster: `global-gaming-platform-cluster`
- Region: `eu-west-2`
- Services: 
  - `global-gaming-platform-auth-service`
  - `global-gaming-platform-leaderboard-service`
  - `global-gaming-platform-frontend`
  - `global-gaming-platform-game-engine`
