# Complete Deployment Plan - All Services

## ✅ What's Been Fixed

### 1. Code Issues - All Resolved
- ✅ Game Engine: DatabaseManager, CacheManager, routes, health checks
- ✅ Auth Service: Fixed `jwks-client` → `jwks-rsa` dependency
- ✅ All Dockerfiles: Changed `npm ci` → `npm install`
- ✅ All services ready to build

### 2. ECR Repositories - All Created
- ✅ global-gaming-platform/game-engine
- ✅ global-gaming-platform/auth-service
- ✅ global-gaming-platform/leaderboard-service
- ✅ global-gaming-platform/frontend

### 3. Terraform Configuration - Added
- ✅ Created `infrastructure/terraform/modules/ecs/services.tf`
- ✅ Added all service definitions (auth, leaderboard, frontend)
- ✅ Configured ALB path-based routing
- ✅ Added variables and outputs

## 🎯 Deployment Steps

### Step 1: Apply Terraform to Create ECS Services
```bash
./scripts/apply-ecs-services.sh
```

This will create:
- Auth service ECS task definition and service
- Leaderboard service ECS task definition and service
- Frontend ECS task definition and service
- ALB listener rules for path-based routing

### Step 2: Build and Deploy All Services
```bash
./scripts/deploy-all-services.sh
```

This will:
- Build Docker images for all services
- Push images to ECR
- Force ECS to deploy new images

### Step 3: Verify Deployment
```bash
./scripts/check-all-services.sh
```

## 🔀 ALB Path-Based Routing Configuration

The ALB is configured with the following routing rules (by priority):

| Priority | Path Pattern | Target Service | Port |
|----------|-------------|----------------|------|
| 10 | `/api/auth/*`, `/api/user/*` | auth-service | 3001 |
| 20 | `/api/leaderboard/*` | leaderboard-service | 3002 |
| 100 (game) | `/api/game/*`, `/health` | game-engine | 3000 |
| 100 (frontend) | `/*` | frontend | 80 |

### How It Works:
1. **API requests** are routed to backend services based on path
2. **Frontend** catches all other paths (lowest priority)
3. **Health checks** go to individual service `/health` endpoints

### Example URLs:
```
http://ALB_DNS/api/auth/login          → auth-service
http://ALB_DNS/api/user/profile        → auth-service
http://ALB_DNS/api/leaderboard/top10   → leaderboard-service
http://ALB_DNS/api/game/status         → game-engine
http://ALB_DNS/                        → frontend
http://ALB_DNS/about                   → frontend
```

## 📊 Service Architecture

```
                    Internet
                       ↓
          Application Load Balancer
                       ↓
    ┌──────────────────┴──────────────────┐
    │     Path-Based Routing              │
    ├─────────────────────────────────────┤
    │  /api/auth/*      → auth:3001       │
    │  /api/user/*      → auth:3001       │
    │  /api/leaderboard/* → leaderboard:3002 │
    │  /api/game/*      → game:3000       │
    │  /*               → frontend:80     │
    └─────────────────────────────────────┘
                       ↓
            ECS Fargate Services
    ┌─────────────────────────────────────┐
    │  - auth-service (2 tasks)           │
    │  - leaderboard-service (2 tasks)    │
    │  - game-engine (2 tasks)            │
    │  - frontend (2 tasks)               │
    └─────────────────────────────────────┘
                       ↓
            Backend Services
    ┌─────────────────────────────────────┐
    │  - RDS Aurora PostgreSQL            │
    │  - ElastiCache Redis                │
    │  - DynamoDB                         │
    │  - Cognito                          │
    └─────────────────────────────────────┘
```

## 🔧 Service Configuration

### Auth Service
- **Port**: 3001
- **Health Check**: `/health`
- **Paths**: `/api/auth/*`, `/api/user/*`
- **CPU**: 256
- **Memory**: 512 MB
- **Desired Count**: 2

### Leaderboard Service
- **Port**: 3002
- **Health Check**: `/health`
- **Paths**: `/api/leaderboard/*`
- **CPU**: 256
- **Memory**: 512 MB
- **Desired Count**: 2

### Game Engine
- **Port**: 3000
- **Health Check**: `/health`
- **Paths**: `/api/game/*`
- **CPU**: 512
- **Memory**: 1024 MB
- **Desired Count**: 2

### Frontend
- **Port**: 80
- **Health Check**: `/`
- **Paths**: `/*` (catch-all)
- **CPU**: 256
- **Memory**: 512 MB
- **Desired Count**: 2

## 📝 Monitoring Commands

### Check All Services
```bash
./scripts/check-all-services.sh
```

### View Individual Service Logs
```bash
aws logs tail /ecs/auth-service --region eu-west-2 --follow
aws logs tail /ecs/leaderboard-service --region eu-west-2 --follow
aws logs tail /ecs/game-engine --region eu-west-2 --follow
aws logs tail /ecs/frontend --region eu-west-2 --follow
```

### Check Target Group Health
```bash
aws elbv2 describe-target-health \
  --region eu-west-2 \
  --target-group-arn <TARGET_GROUP_ARN>
```

### Get ALB DNS Name
```bash
aws elbv2 describe-load-balancers \
  --region eu-west-2 \
  --query 'LoadBalancers[0].DNSName' \
  --output text
```

## 🚀 Quick Start

```bash
# 1. Create ECS services
./scripts/apply-ecs-services.sh

# 2. Deploy all services
./scripts/deploy-all-services.sh

# 3. Check status
./scripts/check-all-services.sh

# 4. Get ALB URL
aws elbv2 describe-load-balancers \
  --region eu-west-2 \
  --query 'LoadBalancers[0].DNSName' \
  --output text
```

## ✅ Success Criteria

- [ ] Terraform apply completes successfully
- [ ] All 4 ECS services created
- [ ] All Docker images built and pushed
- [ ] All services show 2/2 healthy tasks
- [ ] All target groups show "healthy" status
- [ ] ALB routing works for all paths
- [ ] Health checks passing for all services

## 🔍 Troubleshooting

### If Terraform Apply Fails
- Check AWS credentials are valid
- Verify all required variables are set
- Review terraform plan output for errors

### If Service Won't Start
- Check CloudWatch logs for errors
- Verify environment variables
- Check security group rules
- Ensure IAM roles have correct permissions

### If Health Checks Fail
- Verify health endpoint returns 200
- Check container port matches target group
- Review security group ingress rules
- Check application logs for startup errors

## 📚 Additional Resources

- **Terraform Module**: `infrastructure/terraform/modules/ecs/`
- **Deployment Scripts**: `scripts/`
- **Service Code**: `src/`
- **Documentation**: `docs/`

---

**Ready to deploy!** Run `./scripts/apply-ecs-services.sh` to create the ECS services, then `./scripts/deploy-all-services.sh` to deploy the applications.
