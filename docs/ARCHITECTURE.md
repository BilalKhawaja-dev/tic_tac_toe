# System Architecture

## Overview

The Global Gaming Platform is a cloud-native, microservices-based application deployed on AWS using ECS Fargate.

## High-Level Architecture

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │
       ├─── HTTP ────┐
       │             │
       └─ WebSocket ─┤
                     ▼
┌─────────────────────────────────────┐
│   Application Load Balancer (ALB)  │
│   - HTTP/HTTPS routing              │
│   - WebSocket upgrade support       │
│   - Sticky sessions enabled         │
└──────┬──────────────────────────────┘
       │
       ├─────────────────┬──────────────┬─────────────────┐
       ▼                 ▼              ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Frontend   │  │ Game Engine  │  │ Leaderboard  │  │ Auth Service │
│   (Nginx)    │  │  + WebSocket │  │   Service    │  │              │
│              │  │   Server     │  │              │  │              │
└──────────────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                         │                  │                 │
                         └──────────────────┴─────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────┐
                    │   RDS Aurora PostgreSQL (shared)     │
                    │   - users, games, leaderboard, chat  │
                    └──────────────────────────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────┐
                    │   ElastiCache Redis (shared)         │
                    │   - sessions, cache, pub/sub         │
                    └──────────────────────────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────┐
                    │   AWS Secrets Manager                │
                    │   - JWT key, DB creds, Redis auth    │
                    └──────────────────────────────────────┘
```

## Components

### Frontend Service

- **Technology**: React 18 + Vite
- **Server**: Nginx
- **Deployment**: ECS Fargate
- **Scaling**: 1-3 tasks
- **Purpose**: Serve static assets and SPA

### Auth Service

- **Technology**: Node.js + Express
- **Integration**: AWS Cognito
- **Deployment**: ECS Fargate
- **Scaling**: 2-5 tasks
- **Purpose**: User authentication and JWT management

### Game Engine Service

- **Technology**: Node.js + WebSocket
- **Deployment**: ECS Fargate
- **Scaling**: 2-10 tasks
- **Purpose**: Real-time game state management

### Leaderboard Service

- **Technology**: Node.js + Express
- **Deployment**: ECS Fargate
- **Scaling**: 1-3 tasks
- **Purpose**: Rankings and player statistics

### Database Layer

- **Primary**: Aurora PostgreSQL (Serverless v2)
- **Cache**: ElastiCache Redis
- **Backup**: Automated daily snapshots
- **Scaling**: Auto-scaling based on CPU/connections

## Network Architecture

### VPC Configuration

- **CIDR**: 10.0.0.0/16
- **Public Subnets**: 2 AZs (10.0.1.0/24, 10.0.2.0/24)
- **Private Subnets**: 2 AZs (10.0.11.0/24, 10.0.12.0/24)
- **Database Subnets**: 2 AZs (10.0.21.0/24, 10.0.22.0/24)

### Security Groups

- **ALB**: Inbound 80/443 from internet
- **ECS Tasks**: Inbound from ALB only
- **Database**: Inbound 5432 from ECS tasks
- **Redis**: Inbound 6379 from ECS tasks

## Data Flow

### Authentication Flow

1. User submits credentials to Auth Service
2. Auth Service validates with Cognito
3. JWT token generated and returned
4. Frontend stores token
5. All subsequent requests include JWT

### Game Flow

1. User connects via WebSocket
2. JWT validated
3. Game room created/joined
4. Moves synchronized in real-time
5. Game completion triggers leaderboard update

### Leaderboard Flow

1. Game Engine calls Leaderboard API
2. Player stats updated in database
3. Rankings recalculated
4. Cache invalidated
5. Updated rankings broadcast via WebSocket

## Scalability

### Horizontal Scaling

- ECS services auto-scale based on CPU/memory
- Aurora read replicas for read-heavy workloads
- Redis cluster mode for high throughput

### Vertical Scaling

- Fargate task sizes adjustable
- Aurora capacity units auto-scale
- Redis node types upgradeable

## High Availability

- Multi-AZ deployment for all services
- Aurora automatic failover
- ECS task health checks
- ALB health checks with automatic replacement

## Security

### Network Security

- Private subnets for compute and data layers
- Security groups with least privilege
- NACLs for additional layer
- VPC Flow Logs enabled

### Application Security

- All secrets in Secrets Manager
- IAM roles for service authentication
- TLS for all communications
- JWT token expiration
- Rate limiting on all endpoints

### Data Security

- Encryption at rest (RDS, Redis)
- Encryption in transit (TLS)
- Automated backups
- Point-in-time recovery

## Monitoring & Observability

### Logging

- CloudWatch Logs for all services
- Structured JSON logging
- Log retention: 30 days

### Metrics

- CloudWatch Metrics for ECS
- Custom application metrics
- ALB metrics
- Database performance insights

### Tracing

- AWS X-Ray integration
- Request tracing across services
- Performance bottleneck identification

## Disaster Recovery

### Backup Strategy

- Daily automated RDS snapshots
- Redis backup to S3
- Infrastructure as Code in Git

### Recovery Procedures

- RDS point-in-time recovery
- Terraform state backup
- Service rollback capability

## Cost Optimization

- Fargate Spot for non-critical workloads
- Aurora Serverless v2 auto-scaling
- S3 lifecycle policies
- CloudWatch log retention policies
- Reserved capacity for predictable workloads

## Future Enhancements

- Multi-region deployment
- CDN for static assets
- API Gateway for unified API
- DynamoDB for game state
- SQS for async processing
- Lambda for serverless functions
