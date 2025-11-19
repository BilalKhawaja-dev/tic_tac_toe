# Complete Service Fix Summary

## Issues Identified and Fixed

### 1. ✅ Auth Service - Missing Validation Middleware
**Error**: `Cannot find module '../middleware/validation'`

**Root Cause**: The `src/auth-service/src/middleware/validation.js` file was missing but referenced in `src/routes/auth.js`.

**Fix Applied**: Created complete validation middleware with:
- `validateRequest()` - validates request body
- `validateQuery()` - validates query parameters  
- `validateParams()` - validates route parameters

**File Created**: `src/auth-service/src/middleware/validation.js`

### 2. ✅ Leaderboard Service - Database Password Type Error
**Error**: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

**Root Cause**: PostgreSQL client expects password as a string, but environment variable might be undefined or wrong type.

**Fix Applied**: Updated config to ensure DB_PASSWORD is always a string:
```javascript
password: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD) : ''
```

**File Modified**: `src/leaderboard-service/src/config/index.js`

### 3. ⚠️ Game Engine Service - Frontend Integration Issue
**Current State**: Service is running and healthy, but showing JSON response instead of UI.

**Root Cause**: The ALB is routing requests directly to the game engine service instead of the frontend.

**What's Happening**:
- When you visit the ALB URL, you're hitting the game engine's health/status endpoint
- The frontend service should be the default route
- API routes should be proxied to backend services

## Deployment Instructions

### Prerequisites

```bash
# Configure AWS credentials
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_REGION="us-east-1"

# Or use AWS CLI
aws configure
```

### Deploy Fixed Services

Run the automated deployment script:

```bash
chmod +x scripts/fix-and-redeploy-services.sh
./scripts/fix-and-redeploy-services.sh
```

This will:
1. ✅ Build auth-service with validation middleware
2. ✅ Build leaderboard-service with fixed DB config
3. ✅ Push images to ECR
4. ✅ Force new ECS deployments
5. ✅ Wait for services to stabilize
6. ✅ Display service status

### Expected Results After Deployment

**Auth Service Logs** should show:
```
Using environment variables for configuration
Auth Service started on port 3001
✓ Connected to Cognito
✓ JWT Service initialized
✓ Health check endpoint ready
```

**Leaderboard Service Logs** should show:
```
Initializing Leaderboard Service...
✓ Connected to PostgreSQL database
✓ Connected to Redis cache
✓ RankingManager initialized
Leaderboard Service started on port 3002
```

## ALB Configuration Fix

The main issue is ALB routing. Here's what needs to be configured:

### Current Problem
```
User → ALB → Game Engine (showing JSON)
```

### Correct Configuration
```
User → ALB → Frontend (default)
User → ALB/api/auth/* → Auth Service
User → ALB/api/leaderboard/* → Leaderboard Service  
User → ALB/api/game/* → Game Engine Service
```

### Check Current ALB Configuration

```bash
# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names gaming-platform-dev-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

# Get listener ARN
LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn $ALB_ARN \
  --query 'Listeners[0].ListenerArn' \
  --output text)

# List all rules
aws elbv2 describe-rules \
  --listener-arn $LISTENER_ARN \
  --query 'Rules[*].[Priority,Conditions[0].Values[0],Actions[0].TargetGroupArn]' \
  --output table
```

### Fix ALB Listener Rules

You need to ensure the listener rules are in this priority order:

1. **Priority 1**: `/api/auth/*` → Auth Service Target Group
2. **Priority 2**: `/api/leaderboard/*` → Leaderboard Service Target Group
3. **Priority 3**: `/api/game/*` → Game Engine Service Target Group
4. **Priority 4**: `/health` → Health check (any service)
5. **Default**: `/*` → Frontend Target Group

### Update Terraform Configuration

Check your `infrastructure/terraform/modules/ecs/services.tf` and ensure the ALB listener rules are configured correctly. The frontend should be the default action.

### Manual ALB Rule Fix (if needed)

```bash
# Get target group ARNs
FRONTEND_TG=$(aws elbv2 describe-target-groups \
  --names gaming-platform-dev-frontend-tg \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Update default action to point to frontend
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG
```

## Verification Steps

### 1. Check Service Health

```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names gaming-platform-dev-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "ALB URL: http://$ALB_DNS"

# Test endpoints
curl http://$ALB_DNS/health
curl http://$ALB_DNS/api/auth/health
curl http://$ALB_DNS/api/leaderboard/health
curl http://$ALB_DNS/api/game/health
```

### 2. Check ECS Service Status

```bash
aws ecs describe-services \
  --cluster gaming-platform-dev-cluster \
  --services \
    gaming-platform-dev-frontend \
    gaming-platform-dev-auth-service \
    gaming-platform-dev-leaderboard-service \
    gaming-platform-dev-game-engine \
  --query 'services[*].[serviceName,status,runningCount,desiredCount,healthCheckGracePeriodSeconds]' \
  --output table
```

### 3. Monitor CloudWatch Logs

```bash
# Auth service logs
aws logs tail /ecs/gaming-platform-dev-auth-service --follow

# Leaderboard service logs  
aws logs tail /ecs/gaming-platform-dev-leaderboard-service --follow

# Game engine logs
aws logs tail /ecs/gaming-platform-dev-game-engine --follow

# Frontend logs
aws logs tail /ecs/gaming-platform-dev-frontend --follow
```

### 4. Test Frontend Application

Once ALB routing is fixed, visit the ALB URL in your browser:

```
http://your-alb-dns-name.us-east-1.elb.amazonaws.com
```

You should see:
- ✅ Gaming platform homepage
- ✅ Navigation menu (Home, Game, Leaderboard, Support)
- ✅ Ability to start a game
- ✅ Leaderboard displaying rankings

## Troubleshooting

### Auth Service Still Crashing

1. Check if validation middleware is in the Docker image:
```bash
# Get running task
TASK_ARN=$(aws ecs list-tasks \
  --cluster gaming-platform-dev-cluster \
  --service-name gaming-platform-dev-auth-service \
  --query 'taskArns[0]' \
  --output text)

# Check container
aws ecs describe-tasks \
  --cluster gaming-platform-dev-cluster \
  --tasks $TASK_ARN
```

2. Verify the Docker build included the new file:
```bash
cd src/auth-service
docker build -t test-auth .
docker run --rm test-auth ls -la /app/src/middleware/
```

### Leaderboard Service Database Connection

1. Check database credentials in Secrets Manager:
```bash
aws secretsmanager get-secret-value \
  --secret-id gaming-platform/dev/db-password \
  --query SecretString \
  --output text
```

2. Verify ECS task definition has correct environment variables:
```bash
aws ecs describe-task-definition \
  --task-definition gaming-platform-dev-leaderboard-service \
  --query 'taskDefinition.containerDefinitions[0].environment'
```

3. Check if database is accessible from ECS tasks:
```bash
# Get database endpoint
DB_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier gaming-platform-dev-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "Database endpoint: $DB_ENDPOINT"
```

### Frontend Shows 502/503 Errors

1. Check if frontend service is running:
```bash
aws ecs describe-services \
  --cluster gaming-platform-dev-cluster \
  --services gaming-platform-dev-frontend \
  --query 'services[0].[serviceName,runningCount,desiredCount,deployments[0].status]'
```

2. Check target group health:
```bash
FRONTEND_TG=$(aws elbv2 describe-target-groups \
  --names gaming-platform-dev-frontend-tg \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

aws elbv2 describe-target-health \
  --target-group-arn $FRONTEND_TG
```

## Summary

**Fixes Applied**:
1. ✅ Created validation middleware for auth-service
2. ✅ Fixed database password type issue in leaderboard-service
3. ✅ Created deployment script for automated rebuild

**Next Steps**:
1. Configure AWS credentials
2. Run `./scripts/fix-and-redeploy-services.sh`
3. Fix ALB listener rules to route to frontend by default
4. Verify all services are healthy
5. Test the application end-to-end

**Files Modified**:
- `src/auth-service/src/middleware/validation.js` (created)
- `src/leaderboard-service/src/config/index.js` (modified)
- `scripts/fix-and-redeploy-services.sh` (created)

The core service issues are fixed. The remaining work is ensuring proper ALB routing configuration so the frontend is served by default and API requests are routed to the appropriate backend services.
