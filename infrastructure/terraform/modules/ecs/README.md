# ECS Infrastructure Module

This Terraform module creates and manages the Amazon ECS (Elastic Container Service) infrastructure for the Global Gaming Platform, including the game engine service, load balancer, auto-scaling, and monitoring components.

## Architecture Overview

The module provisions:
- **ECS Fargate Cluster** with Container Insights enabled
- **Application Load Balancer (ALB)** with HTTPS termination and health checks
- **Game Engine Service** running on ECS Fargate with auto-scaling
- **ECR Repository** for Docker image storage with lifecycle policies
- **Auto Scaling Policies** based on CPU, memory, and WebSocket connections
- **CloudWatch Monitoring** with alarms and logging
- **Security Groups** and network configuration for secure communication

## Features

### High Availability
- Multi-AZ deployment across private subnets
- Auto-scaling based on multiple metrics (CPU, memory, connections)
- Health checks and automatic task replacement
- Blue-green deployment support with circuit breaker

### Security
- Tasks run in private subnets with no public IP
- Encrypted ECR repository with KMS
- Secrets management for database and Redis credentials
- Security groups with least privilege access
- ECS Exec disabled by default (can be enabled for debugging)

### Performance
- Fargate Spot instances support for cost optimization
- Connection-based auto-scaling for WebSocket workloads
- Optimized health check configuration
- Container resource limits and ulimits

### Monitoring
- CloudWatch Container Insights
- Custom metrics for business KPIs
- Comprehensive alarms for CPU, memory, and response time
- Structured logging with retention policies

## Usage

```hcl
module "ecs" {
  source = "./modules/ecs"

  # Project Configuration
  project_name = "global-gaming-platform"
  environment  = "production"
  
  # Network Configuration
  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  private_subnet_ids    = module.network.private_subnet_ids
  alb_security_group_id = module.security.alb_security_group_id
  ecs_security_group_id = module.security.ecs_security_group_id
  
  # Security Configuration
  kms_key_arn           = module.security.kms_key_arn
  ssl_certificate_arn   = "arn:aws:acm:region:account:certificate/cert-id"
  
  # IAM Roles
  ecs_task_execution_role_arn = module.security.ecs_task_execution_role_arn
  ecs_task_role_arn          = module.security.ecs_task_role_arn
  
  # Database Configuration
  database_endpoint     = module.database.aurora_endpoint
  database_name         = module.database.database_name
  database_secret_arn   = module.database.database_secret_arn
  
  # DynamoDB Configuration
  dynamodb_games_table       = module.database.games_table_name
  dynamodb_moves_table       = module.database.moves_table_name
  dynamodb_leaderboard_table = module.database.leaderboard_table_name
  dynamodb_sessions_table    = module.database.sessions_table_name
  dax_endpoint              = module.database.dax_endpoint
  
  # Cache Configuration
  redis_endpoint    = module.database.redis_endpoint
  redis_secret_arn  = module.database.redis_secret_arn
  
  # JWT Configuration
  jwt_secret_arn = module.security.jwt_secret_arn
  
  # Service Configuration
  game_engine_desired_count = 3
  game_engine_min_capacity  = 2
  game_engine_max_capacity  = 20
  
  # Monitoring
  game_engine_log_group   = "/aws/ecs/global-gaming-platform/game-engine"
  warning_sns_topic_arn   = module.monitoring.warning_sns_topic_arn
  info_sns_topic_arn      = module.monitoring.info_sns_topic_arn
  
  tags = {
    Environment = "production"
    Project     = "global-gaming-platform"
    Component   = "ecs"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| project_name | Name of the project | `string` | n/a | yes |
| environment | Environment name (development, staging, production) | `string` | n/a | yes |
| vpc_id | ID of the VPC | `string` | n/a | yes |
| public_subnet_ids | List of public subnet IDs for ALB | `list(string)` | n/a | yes |
| private_subnet_ids | List of private subnet IDs for ECS tasks | `list(string)` | n/a | yes |
| alb_security_group_id | Security group ID for the Application Load Balancer | `string` | n/a | yes |
| ecs_security_group_id | Security group ID for ECS tasks | `string` | n/a | yes |
| kms_key_arn | ARN of the KMS key for encryption | `string` | n/a | yes |
| ecs_task_execution_role_arn | ARN of the ECS task execution role | `string` | n/a | yes |
| ecs_task_role_arn | ARN of the ECS task role | `string` | n/a | yes |
| database_endpoint | Aurora database endpoint | `string` | n/a | yes |
| database_name | Aurora database name | `string` | n/a | yes |
| database_secret_arn | ARN of the database credentials secret | `string` | n/a | yes |
| game_engine_log_group | CloudWatch log group for game engine service | `string` | n/a | yes |
| warning_sns_topic_arn | SNS topic ARN for warning alerts | `string` | n/a | yes |
| info_sns_topic_arn | SNS topic ARN for info alerts | `string` | n/a | yes |
| ssl_certificate_arn | ARN of the SSL certificate for HTTPS listener | `string` | `""` | no |
| game_engine_cpu | CPU units for the game engine task (1024 = 1 vCPU) | `number` | `512` | no |
| game_engine_memory | Memory for the game engine task in MiB | `number` | `1024` | no |
| game_engine_desired_count | Desired number of game engine tasks | `number` | `2` | no |
| game_engine_min_capacity | Minimum number of game engine tasks | `number` | `1` | no |
| game_engine_max_capacity | Maximum number of game engine tasks | `number` | `10` | no |
| enable_container_insights | Enable CloudWatch Container Insights for the ECS cluster | `bool` | `true` | no |
| enable_fargate_spot | Enable Fargate Spot capacity provider | `bool` | `false` | no |
| cpu_target_value | Target CPU utilization percentage for auto scaling | `number` | `70` | no |
| memory_target_value | Target memory utilization percentage for auto scaling | `number` | `80` | no |
| enable_connection_based_scaling | Enable auto scaling based on WebSocket connections | `bool` | `true` | no |
| connections_target_value | Target number of connections per task for auto scaling | `number` | `100` | no |

## Outputs

| Name | Description |
|------|-------------|
| ecs_cluster_id | ID of the ECS cluster |
| ecs_cluster_name | Name of the ECS cluster |
| alb_dns_name | DNS name of the Application Load Balancer |
| alb_zone_id | Zone ID of the Application Load Balancer |
| game_engine_ecr_repository_url | URL of the game engine ECR repository |
| game_engine_service_name | Name of the game engine ECS service |
| deployment_info | Deployment information for the ECS services |
| health_check_endpoints | Health check endpoints for monitoring |
| scaling_configuration | Auto scaling configuration details |

## Auto Scaling

The module implements three types of auto-scaling:

### 1. CPU-Based Scaling
- Target: 70% CPU utilization
- Scale out when CPU > 70% for 2 consecutive periods
- Scale in when CPU < 70% for 2 consecutive periods

### 2. Memory-Based Scaling
- Target: 80% memory utilization
- Scale out when memory > 80% for 2 consecutive periods
- Scale in when memory < 80% for 2 consecutive periods

### 3. Connection-Based Scaling (Optional)
- Target: 100 WebSocket connections per task
- Custom CloudWatch metric: `ActiveConnections`
- Ideal for real-time gaming workloads

## Health Checks

### Application Load Balancer Health Check
- **Path**: `/health`
- **Port**: 3000
- **Protocol**: HTTP
- **Healthy Threshold**: 2 successful checks
- **Unhealthy Threshold**: 3 failed checks
- **Timeout**: 10 seconds
- **Interval**: 30 seconds

### Container Health Check
- **Command**: `curl -f http://localhost:3000/health || exit 1`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3
- **Start Period**: 60 seconds

## Security Considerations

1. **Network Security**
   - ECS tasks run in private subnets
   - No public IP addresses assigned to tasks
   - Security groups restrict traffic to necessary ports only

2. **Encryption**
   - ECR repository encrypted with KMS
   - ECS logs encrypted with KMS
   - Secrets stored in AWS Secrets Manager

3. **IAM Permissions**
   - Separate execution and task roles
   - Least privilege access principles
   - No hardcoded credentials

4. **Container Security**
   - Non-root user in containers
   - Read-only root filesystem where possible
   - Security scanning enabled on ECR

## Monitoring and Alerting

### CloudWatch Alarms
- **ECS Service CPU High**: Triggers when CPU > 80%
- **ECS Service Memory High**: Triggers when memory > 80%
- **ALB Response Time High**: Triggers when response time > 1 second

### Custom Metrics
- Active WebSocket connections
- Game sessions per minute
- Player authentication rate
- Error rates by endpoint

### Log Groups
- ECS task logs: `/aws/ecs/{project_name}/game-engine`
- ECS Exec logs: `/aws/ecs/{project_name}/exec`
- ALB access logs: S3 bucket (optional)

## Deployment

### Blue-Green Deployment
The service is configured for blue-green deployments with:
- Circuit breaker enabled for automatic rollback
- 50% minimum healthy capacity during deployment
- 200% maximum capacity during deployment

### Image Deployment
1. Build and push Docker image to ECR
2. Update task definition with new image tag
3. ECS automatically performs rolling deployment
4. Health checks validate new tasks before routing traffic

## Cost Optimization

### Fargate Spot (Optional)
- Enable `enable_fargate_spot = true` for cost savings
- Suitable for development and staging environments
- Not recommended for production due to potential interruptions

### Resource Right-Sizing
- Monitor CPU and memory utilization
- Adjust `game_engine_cpu` and `game_engine_memory` based on actual usage
- Use CloudWatch Container Insights for optimization recommendations

## Troubleshooting

### Common Issues

1. **Service Not Starting**
   - Check CloudWatch logs for container errors
   - Verify security group rules allow traffic
   - Ensure secrets are accessible from task role

2. **Health Check Failures**
   - Verify `/health` endpoint is implemented
   - Check container port mapping (3000)
   - Review health check timeout and interval settings

3. **Auto Scaling Not Working**
   - Verify CloudWatch metrics are being published
   - Check auto scaling policies and target values
   - Ensure sufficient capacity in target subnets

### Debugging Commands

```bash
# View service status
aws ecs describe-services --cluster {cluster_name} --services {service_name}

# View task logs
aws logs get-log-events --log-group-name /aws/ecs/{project_name}/game-engine --log-stream-name {stream_name}

# Execute command in running task (if ECS Exec enabled)
aws ecs execute-command --cluster {cluster_name} --task {task_arn} --container game-engine --interactive --command "/bin/sh"
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.6.0 |
| aws | ~> 5.0 |

## Dependencies

This module depends on:
- Network module (VPC, subnets, security groups)
- Security module (IAM roles, KMS keys, secrets)
- Database module (Aurora, DynamoDB, Redis)
- Monitoring module (SNS topics, CloudWatch)

## License

This module is part of the Global Gaming Platform project and is proprietary software.