# Services Fix Guide

## Issues Fixed

### 1. Auth Service - Missing Validation Middleware
**Error**: `Cannot find module '../middleware/validation'`

**Fix Applied**: Created `src/auth-service/src/middleware/validation.js` with proper validation functions.

### 2. Leaderboard Service - Database Password Type Error
**Error**: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

**Fix Applied**: Updated `src/leaderboard-service/src/config/index.js` to ensure DB_PASSWORD is always a string.

### 3. Game Engine Service - Frontend Integration
**Status**: Service is running but showing JSON instead of UI.

**Issue**: Frontend needs to be configured to connect to the game engine service properly.

## Deployment Steps

### Step 1: Configure AWS Credentials

```bash
# Set your AWS credentials
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"

# Or use AWS CLI configure
aws configure
```

### Step 2: Run the Fix and Redeploy Script

```bash
./scripts/fix-and-redeploy-services.sh
```

This script will:
1. Login to ECR
2. Build and push auth-service with validation middleware
3. Build and push leaderboard-service with fixed DB config
4. Force new deployments for both services
5. Wait for services to stabilize
6. Show service status

### Step 3: Verify Services

After deployment, check the CloudWatch logs:

**Auth Service** should show:
```
Auth Service started on port 3001
Connected to Cognito
```

**Leaderboard Service** should show:
```
Leaderboard Service started on port 3002
Connected to database
Connected to Redis cache
```

### Step 4: Check Service Health

```bash
# Get service endpoints
aws ecs describe-services \
  --cluster gaming-platform-dev-cluster \
  --services gaming-platform-dev-auth-service gaming-platform-dev-leaderboard-service \
  --query 'services[*].[serviceName,loadBalancers[0].targetGroupArn]' \
  --output table

# Test health endpoints
curl https://your-alb-url/auth/health
curl https://your-alb-url/leaderboard/health
```

## Manual Build and Push (Alternative)

If you prefer to build and push manually:

### Auth Service

```bash
cd src/auth-service

# Get ECR login
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t gaming-platform-auth-service:latest .
docker tag gaming-platform-auth-service:latest \
  ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/gaming-platform-auth-service:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/gaming-platform-auth-service:latest

# Force new deployment
aws ecs update-service \
  --cluster gaming-platform-dev-cluster \
  --service gaming-platform-dev-auth-service \
  --force-new-deployment
```

### Leaderboard Service

```bash
cd src/leaderboard-service

# Build and push
docker build -t gaming-platform-leaderboard-service:latest .
docker tag gaming-platform-leaderboard-service:latest \
  ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/gaming-platform-leaderboard-service:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/gaming-platform-leaderboard-service:latest

# Force new deployment
aws ecs update-service \
  --cluster gaming-platform-dev-cluster \
  --service gaming-platform-dev-leaderboard-service \
  --force-new-deployment
```

## Frontend Configuration

The game engine is running but showing JSON because the frontend needs proper routing. Update your ALB listener rules to route:

- `/` → Frontend service
- `/api/auth/*` → Auth service
- `/api/leaderboard/*` → Leaderboard service
- `/api/game/*` → Game engine service

Check your ALB configuration:

```bash
# List target groups
aws elbv2 describe-target-groups \
  --query 'TargetGroups[*].[TargetGroupName,TargetGroupArn]' \
  --output table

# Check listener rules
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names gaming-platform-dev-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

aws elbv2 describe-listeners \
  --load-balancer-arn $ALB_ARN \
  --query 'Listeners[*].[ListenerArn,Port,Protocol]' \
  --output table
```

## Troubleshooting

### Auth Service Still Failing

Check if the validation middleware is included in the Docker image:

```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster gaming-platform-dev-cluster \
  --service-name gaming-platform-dev-auth-service \
  --query 'taskArns[0]' \
  --output text)

# Check logs
aws logs tail /ecs/gaming-platform-dev-auth-service --follow
```

### Leaderboard Service Database Connection

Verify the database password is set correctly in ECS task definition:

```bash
aws ecs describe-task-definition \
  --task-definition gaming-platform-dev-leaderboard-service \
  --query 'taskDefinition.containerDefinitions[0].environment' \
  --output table
```

The DB_PASSWORD should be coming from Secrets Manager or Parameter Store, not hardcoded.

### Frontend Not Loading

1. Check if frontend service is running
2. Verify ALB listener rules route `/` to frontend target group
3. Check frontend environment variables point to correct API endpoints

```bash
# Check frontend service
aws ecs describe-services \
  --cluster gaming-platform-dev-cluster \
  --services gaming-platform-dev-frontend \
  --query 'services[0].[serviceName,status,runningCount,desiredCount]' \
  --output table
```

## Next Steps

1. Configure AWS credentials
2. Run the deployment script
3. Monitor CloudWatch logs for both services
4. Verify health endpoints are responding
5. Test the frontend application
6. Check that all API routes are working through the ALB
