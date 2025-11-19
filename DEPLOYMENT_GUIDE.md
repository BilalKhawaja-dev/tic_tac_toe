# Service Deployment Guide

## Quick Start

After refreshing your AWS credentials for eu-west-2:

### Deploy All Services
```bash
./scripts/deploy-all-services.sh
```

### Deploy Individual Services
```bash
./scripts/deploy-game-engine.sh        # Already deployed ✅
./scripts/deploy-auth-service.sh
./scripts/deploy-leaderboard-service.sh
./scripts/deploy-frontend.sh
```

### Check Status
```bash
./scripts/check-all-services.sh
```

## Services Overview

### 1. Game Engine ✅ (Already Deployed & Healthy)
- **ECR**: `global-gaming-platform/game-engine`
- **ECS Service**: `global-gaming-platform-game-engine`
- **Port**: 3000
- **Health Check**: `/health`
- **Status**: Running with 2 healthy tasks

### 2. Auth Service
- **ECR**: `global-gaming-platform/auth-service`
- **ECS Service**: `global-gaming-platform-auth-service`
- **Port**: 3001
- **Health Check**: `/health`

### 3. Leaderboard Service
- **ECR**: `global-gaming-platform/leaderboard-service`
- **ECS Service**: `global-gaming-platform-leaderboard-service`
- **Port**: 3002
- **Health Check**: `/health`

### 4. Frontend
- **ECR**: `global-gaming-platform/frontend`
- **ECS Service**: `global-gaming-platform-frontend`
- **Port**: 80
- **Health Check**: `/`

### 5. Support Service
- **Type**: Lambda (Serverless)
- **Deploy**: `cd src/support-service && serverless deploy`

## Deployment Process

Each service deployment follows these steps:

1. **Login to ECR**
   ```bash
   aws ecr get-login-password --region eu-west-2 | \
     docker login --username AWS --password-stdin \
     981686514879.dkr.ecr.eu-west-2.amazonaws.com
   ```

2. **Build Docker Image**
   ```bash
   docker build -t service-name:tag src/service-name/
   ```

3. **Tag for ECR**
   ```bash
   docker tag service-name:tag ECR_REPO:tag
   docker tag service-name:latest ECR_REPO:latest
   ```

4. **Push to ECR**
   ```bash
   docker push ECR_REPO:tag
   docker push ECR_REPO:latest
   ```

5. **Force ECS Deployment**
   ```bash
   aws ecs update-service \
     --region eu-west-2 \
     --cluster global-gaming-platform-cluster \
     --service SERVICE_NAME \
     --force-new-deployment
   ```

## Monitoring

### View Service Status
```bash
aws ecs describe-services \
  --region eu-west-2 \
  --cluster global-gaming-platform-cluster \
  --services SERVICE_NAME
```

### View Logs
```bash
# Game Engine
aws logs tail /ecs/game-engine --region eu-west-2 --follow

# Auth Service
aws logs tail /ecs/auth-service --region eu-west-2 --follow

# Leaderboard Service
aws logs tail /ecs/leaderboard-service --region eu-west-2 --follow

# Frontend
aws logs tail /ecs/frontend --region eu-west-2 --follow
```

### Check Target Health
```bash
aws elbv2 describe-target-health \
  --region eu-west-2 \
  --target-group-arn TARGET_GROUP_ARN
```

## Troubleshooting

### Service Won't Start
1. Check logs: `aws logs tail /ecs/SERVICE_NAME --region eu-west-2 --follow`
2. Verify environment variables in ECS task definition
3. Check security group rules
4. Verify IAM roles and permissions

### Health Check Failing
1. Verify health endpoint returns 200 status code
2. Check health check path matches route configuration
3. Ensure container port matches target group port
4. Review security group ingress rules

### Image Push Fails
1. Verify ECR repository exists
2. Check AWS credentials are valid
3. Ensure you're logged into ECR
4. Verify IAM permissions for ECR

## Common Issues Fixed

### Game Engine Issues (Already Fixed ✅)
1. **Missing initialize() method** - Added to DatabaseManager and CacheManager
2. **Routes returning undefined** - Changed game routes to function export
3. **Health check path mismatch** - Changed route from `/health` to `/` (mounted at `/health`)
4. **Request logger showing [object Object]** - Added message string parameter

## Next Steps

1. Refresh AWS credentials for eu-west-2
2. Run `./scripts/deploy-all-services.sh`
3. Monitor deployment with `./scripts/check-all-services.sh`
4. Verify health checks pass
5. Test endpoints through ALB

## Architecture

```
Internet
    ↓
Application Load Balancer
    ↓
┌─────────────────────────────────────┐
│  Target Groups                      │
├─────────────────────────────────────┤
│  - game-engine:3000                 │
│  - auth-service:3001                │
│  - leaderboard-service:3002         │
│  - frontend:80                      │
└─────────────────────────────────────┘
    ↓
ECS Fargate Tasks (2 per service)
    ↓
┌─────────────────────────────────────┐
│  Backend Services                   │
├─────────────────────────────────────┤
│  - RDS Aurora PostgreSQL            │
│  - ElastiCache Redis                │
│  - DynamoDB                         │
│  - Cognito                          │
└─────────────────────────────────────┘
```

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review ECS service events
3. Verify target group health
4. Check security group rules
5. Review IAM permissions
