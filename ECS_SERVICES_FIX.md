# ECS Services Fix - Frontend & Leaderboard

## Issues Identified

### 1. Frontend Service - Port Binding Error
**Error**: `bind() to 0.0.0.0:80 failed (13: Permission denied)`

**Root Cause**: 
- nginx.conf was configured to listen on port 80
- Dockerfile runs nginx as non-root user (nginx)
- Non-root users cannot bind to privileged ports (< 1024)

**Fix Applied**:
- Changed nginx.conf to listen on port 8080
- Updated ECS task definition container port from 80 to 8080
- Updated ALB target group port from 80 to 8080
- Updated health check path to `/health`

### 2. Leaderboard Service - Configuration Error
**Error**: `TypeError: Cannot read properties of undefined (reading 'maxLimit')`

**Root Cause**:
- `src/leaderboard-service/src/routes/leaderboard.js` references `config.leaderboard.regions`
- `src/leaderboard-service/src/routes/leaderboard.js` references `config.rateLimit.enabled` and `config.rateLimit.maxRequests`
- `src/leaderboard-service/src/routes/leaderboard.js` references `config.cache.*` properties
- These properties were missing from the config file

**Fix Applied**:
- Added `regions` array to leaderboard config: `['NA', 'EU', 'ASIA', 'SA', 'OCE', 'GLOBAL']`
- Added `enabled` and `maxRequests` to rateLimit config
- Added complete `cache` configuration with TTL values

## Files Modified

1. `src/frontend/nginx.conf` - Changed port 80 to 8080
2. `src/frontend/Dockerfile` - Already configured correctly for port 8080
3. `src/leaderboard-service/src/config/index.js` - Added missing config properties
4. `infrastructure/terraform/modules/ecs/services.tf` - Updated frontend port mappings
5. `scripts/fix-ecs-services.sh` - New deployment script

## Deployment Steps

Run the automated fix script:

```bash
./scripts/fix-ecs-services.sh dev
```

This script will:
1. Apply Terraform changes for frontend port configuration
2. Rebuild and push frontend Docker image
3. Rebuild and push leaderboard service Docker image
4. Force new deployments for both services
5. Wait for services to stabilize
6. Display service status

## Manual Verification

After deployment, check CloudWatch Logs:

**Frontend**:
- Should see: `Configuration complete; ready for start up`
- Should NOT see: `Permission denied` errors

**Leaderboard Service**:
- Should see: `Leaderboard Service started on port 3002`
- Should NOT see: `Cannot read properties of undefined` errors

## Testing

Test the services:

```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names ggp-dev-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Test frontend
curl -I http://$ALB_DNS/

# Test leaderboard service
curl http://$ALB_DNS/api/leaderboard/global
```

## Rollback Plan

If issues persist:

```bash
# Rollback to previous task definitions
aws ecs update-service \
  --cluster ggp-dev-cluster \
  --service ggp-dev-frontend \
  --task-definition <previous-task-def-arn> \
  --force-new-deployment

aws ecs update-service \
  --cluster ggp-dev-cluster \
  --service ggp-dev-leaderboard-service \
  --task-definition <previous-task-def-arn> \
  --force-new-deployment
```
