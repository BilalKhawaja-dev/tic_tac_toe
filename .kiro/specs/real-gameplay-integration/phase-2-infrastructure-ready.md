# Phase 2: Authentication Integration - Infrastructure Status

**Date**: November 20, 2025  
**Status**: Infrastructure Ready ✅

## Infrastructure Review

### ALB Configuration ✅

**HTTP Listener (Port 80)**
- Configured and active
- Default action: 404 fixed response
- Listener rules configured for all services

**Auth Service Routing**
- Path patterns: `/api/auth/*`, `/api/user/*`
- Priority: 10 (higher than game engine)
- Target group: `ggp-development-auth-tg`
- Health check: `/health` endpoint
- Port: 3001

**Game Engine Routing**
- Path patterns: `/api/game/*`
- Priority: 15
- Target group configured
- Port: 3000

**Leaderboard Service Routing**
- Path patterns: `/api/leaderboard/*`
- Priority: 20
- Target group configured
- Port: 3002

### Auth Service ECS Configuration ✅

**Task Definition**
- CPU: 256 (0.25 vCPU)
- Memory: 512 MB
- Network mode: awsvpc
- Container port: 3001

**Service Configuration**
- Desired count: **2 tasks** (already configured for HA)
- Capacity provider: FARGATE
- Health check: `/health` endpoint every 30s
- Deregistration delay: 30s

**Environment Variables**
- NODE_ENV: development
- PORT: 3001
- AWS_REGION: eu-west-2
- COGNITO_USER_POOL_ID: (configured)
- COGNITO_CLIENT_ID: (configured)
- DB_HOST: (Aurora endpoint)
- REDIS_HOST: (ElastiCache endpoint)

**Secrets (from AWS Secrets Manager)**
- DB_PASSWORD: From database secret
- DB_USER: From database secret
- JWT_SECRET: From JWT secret ARN
- SECRET_ARN: (needs to be added for SecretManager)

### Target Group Configuration ✅

**Health Check Settings**
- Protocol: HTTP
- Path: `/health`
- Port: traffic-port (3001)
- Interval: 30 seconds
- Timeout: 10 seconds
- Healthy threshold: 2
- Unhealthy threshold: 3
- Matcher: 200

**Load Balancing**
- Algorithm: Round robin
- Stickiness: Disabled (stateless auth)
- Deregistration delay: 30 seconds

## Required Updates

### 1. Add SECRET_ARN Environment Variable

The auth service needs the `SECRET_ARN` environment variable to use the SecretManager module:

```hcl
# In infrastructure/terraform/modules/ecs/services.tf
# Add to auth_service task definition environment:
{
  name  = "SECRET_ARN"
  value = var.jwt_secret_arn  # Or create a combined secret
}
```

### 2. Verify Secrets Structure

Current secrets:
- `global-gaming-platform/jwt/signing-key` - Contains JWT secret
- `global-gaming-platform/database/credentials` - Contains DB credentials
- `global-gaming-platform/redis/auth` - Contains Redis password

Option A: Use individual secrets (current approach)
Option B: Create combined secret with all credentials (recommended for SecretManager)

### 3. Update Task Definition

Add SECRET_ARN to environment variables so SecretManager can load all secrets from one location.

## ALB Access

**ALB DNS Name**: `global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com`

**Test Endpoints**:
```bash
# Health check
curl http://global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com/api/auth/health

# Auth endpoints (once deployed)
curl http://global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com/api/auth/login
curl http://global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com/api/user/profile
```

## Next Steps

1. ✅ ALB configured on port 80 with HTTP listener
2. ✅ Auth service configured to scale to 2 tasks
3. ✅ Target group and health checks configured
4. ✅ Listener rules configured for `/api/auth/*` and `/api/user/*`
5. ⏭️ Add SECRET_ARN environment variable to task definition
6. ⏭️ Deploy updated task definition
7. ⏭️ Build frontend authentication UI
8. ⏭️ Test end-to-end authentication flow

## Summary

The infrastructure is **ready for Phase 2**. The ALB is properly configured on port 80 with HTTP listener rules routing to the auth service. The auth service is configured to run 2 tasks for high availability. 

The only remaining infrastructure change needed is adding the `SECRET_ARN` environment variable to the task definition so the SecretManager module can load secrets properly.

All routing is in place:
- Port 80 HTTP listener ✅
- Auth service routes (`/api/auth/*`, `/api/user/*`) ✅
- Target group with health checks ✅
- 2-task configuration for HA ✅
