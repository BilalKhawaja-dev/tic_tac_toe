# Deployment Guide

## Overview

This guide covers deploying the Global Gaming Platform to AWS using Terraform and ECS Fargate.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform >= 1.0
- Docker installed
- Node.js >= 18.x
- Git

## Quick Start

### 1. Initialize Repository

```bash
./scripts/setup/init-repository.sh
```

### 2. Set Up Development Environment

```bash
./scripts/setup/setup-dev-environment.sh
```

### 3. Initialize Database

```bash
./scripts/setup/init-database.sh
```

### 4. Deploy Infrastructure

```bash
cd infrastructure/terraform/environments/dev
terraform init
terraform plan
terraform apply
```

### 5. Deploy Services

```bash
./scripts/deploy/deploy-all-services.sh
```

### 6. Verify Deployment

```bash
./scripts/utils/check-all-services.sh
```

## Architecture

The platform consists of:

- **Frontend**: React SPA served via Nginx on ECS Fargate
- **Auth Service**: Node.js authentication service with Cognito integration
- **Game Engine**: Node.js WebSocket server for real-time gameplay
- **Leaderboard Service**: Node.js REST API for rankings and statistics
- **Database**: Aurora PostgreSQL for persistent data
- **Cache**: ElastiCache Redis for session management and caching
- **Load Balancer**: Application Load Balancer for routing

## Environment Variables

### Required Secrets (AWS Secrets Manager)

- `global-gaming-platform/jwt/signing-key` - JWT signing key
- `global-gaming-platform/redis/auth` - Redis authentication token
- `global-gaming-platform/cognito/client-secret` - Cognito client credentials
- `online-tic-tac-toe-aurora-master-password-development` - Database password

### Service Environment Variables

Each service requires:
- `NODE_ENV` - Environment (development/production)
- `SECRET_ARN` - ARN of secrets in Secrets Manager
- `DB_HOST` - Database endpoint
- `REDIS_HOST` - Redis endpoint
- `AWS_REGION` - AWS region

## Deployment Process

### Infrastructure Deployment

1. **Network Layer**: VPC, subnets, security groups
2. **Database Layer**: Aurora PostgreSQL, ElastiCache Redis
3. **Compute Layer**: ECS cluster, task definitions
4. **Load Balancer**: ALB with target groups
5. **Security**: Secrets Manager, IAM roles

### Service Deployment

1. Build Docker images
2. Push to ECR
3. Update ECS task definitions
4. Deploy new tasks
5. Health check verification

## Rollback Procedure

```bash
./scripts/deploy/rollback.sh <previous-version>
```

## Monitoring

- CloudWatch Logs: `/ecs/<service-name>`
- CloudWatch Metrics: ECS service metrics
- ALB Health Checks: Target group health

## Troubleshooting

### Services Not Starting

1. Check CloudWatch logs
2. Verify secrets are accessible
3. Check security group rules
4. Verify task IAM roles

### Database Connection Issues

1. Verify security group allows ECS tasks
2. Check database endpoint in environment variables
3. Verify credentials in Secrets Manager

### Load Balancer Issues

1. Check target group health
2. Verify security group rules
3. Check ALB listener rules

## Cost Optimization

- Use Fargate Spot for non-critical services
- Enable Aurora auto-scaling
- Use ElastiCache reserved instances
- Implement CloudWatch alarms for cost monitoring

## Security Best Practices

- All secrets in AWS Secrets Manager
- No hardcoded credentials
- TLS for all communications
- Security groups with least privilege
- Regular secret rotation
- IAM roles with minimal permissions

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Terraform Modules](../infrastructure/terraform/modules/)
