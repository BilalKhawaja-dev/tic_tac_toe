# Troubleshooting Guide

## Common Issues

### Services Not Starting

**Symptoms**: ECS tasks fail to start or immediately stop

**Possible Causes**:
1. Missing or invalid secrets
2. Incorrect environment variables
3. Security group blocking traffic
4. IAM role permissions insufficient

**Solutions**:

```bash
# Check CloudWatch logs
aws logs tail /ecs/<service-name> --follow

# Verify secrets exist
aws secretsmanager list-secrets --region eu-west-2

# Check task definition
aws ecs describe-task-definition --task-definition <task-def-name>

# Verify IAM role
aws iam get-role --role-name <role-name>
```

### Database Connection Failures

**Symptoms**: Services can't connect to Aurora PostgreSQL

**Possible Causes**:
1. Security group not allowing ECS tasks
2. Incorrect database endpoint
3. Invalid credentials
4. Database not available

**Solutions**:

```bash
# Check database status
aws rds describe-db-clusters --region eu-west-2

# Verify security group rules
aws ec2 describe-security-groups --group-ids <sg-id>

# Test connection from ECS task
aws ecs execute-command \
  --cluster <cluster-name> \
  --task <task-id> \
  --container <container-name> \
  --interactive \
  --command "/bin/sh"

# Inside container:
nc -zv <db-endpoint> 5432
```

### Redis Connection Issues

**Symptoms**: Services can't connect to ElastiCache Redis

**Possible Causes**:
1. Security group blocking port 6379
2. Incorrect Redis endpoint
3. AUTH token mismatch

**Solutions**:

```bash
# Check Redis cluster status
aws elasticache describe-cache-clusters \
  --show-cache-node-info \
  --region eu-west-2

# Verify endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id <cluster-id> \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint'

# Test connection
redis-cli -h <redis-endpoint> -p 6379 -a <auth-token> PING
```

### Load Balancer Health Check Failures

**Symptoms**: ALB marks targets as unhealthy

**Possible Causes**:
1. Service not responding on health check path
2. Health check timeout too short
3. Security group blocking ALB traffic
4. Service taking too long to start

**Solutions**:

```bash
# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn <tg-arn>

# View ALB access logs
aws s3 ls s3://<alb-logs-bucket>/

# Test health endpoint directly
curl http://<task-ip>:<port>/health

# Adjust health check settings
aws elbv2 modify-target-group \
  --target-group-arn <tg-arn> \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 10
```

### WebSocket Connection Failures

**Symptoms**: WebSocket connections fail or disconnect immediately

**Possible Causes**:
1. ALB not configured for WebSocket upgrade
2. Sticky sessions not enabled
3. JWT token invalid or expired
4. Connection timeout too short

**Solutions**:

```bash
# Verify ALB listener rules
aws elbv2 describe-rules --listener-arn <listener-arn>

# Check target group stickiness
aws elbv2 describe-target-groups \
  --target-group-arns <tg-arn> \
  --query 'TargetGroups[0].TargetGroupAttributes'

# Test WebSocket connection
wscat -c wss://<alb-dns>/ws?token=<jwt-token>
```

### High Memory Usage

**Symptoms**: ECS tasks restarting due to OOM

**Possible Causes**:
1. Memory leak in application
2. Task memory limit too low
3. Too many concurrent connections
4. Large cache size

**Solutions**:

```bash
# Check task metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name MemoryUtilization \
  --dimensions Name=ServiceName,Value=<service-name> \
  --start-time <start> \
  --end-time <end> \
  --period 300 \
  --statistics Average

# Increase task memory
# Update task definition with higher memory value

# Enable memory profiling in Node.js
NODE_OPTIONS="--max-old-space-size=2048"
```

### Slow Database Queries

**Symptoms**: API responses slow, database CPU high

**Possible Causes**:
1. Missing indexes
2. Inefficient queries
3. Too many connections
4. Database needs scaling

**Solutions**:

```bash
# Check slow query log
aws rds describe-db-log-files \
  --db-instance-identifier <instance-id>

# View Performance Insights
# Go to RDS console > Performance Insights

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Find slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

# Add indexes
CREATE INDEX idx_user_email ON users(email);
```

### Deployment Failures

**Symptoms**: Terraform apply fails or ECS deployment stuck

**Possible Causes**:
1. Resource limits reached
2. Dependency issues
3. State lock conflict
4. Insufficient permissions

**Solutions**:

```bash
# Check Terraform state
terraform show

# Force unlock if stuck
terraform force-unlock <lock-id>

# Check AWS service quotas
aws service-quotas list-service-quotas \
  --service-code ecs

# Verify IAM permissions
aws sts get-caller-identity
aws iam simulate-principal-policy \
  --policy-source-arn <role-arn> \
  --action-names ecs:UpdateService
```

### Secret Rotation Issues

**Symptoms**: Services fail after secret rotation

**Possible Causes**:
1. Services not refreshing secrets
2. Rotation Lambda failed
3. Old secret still in use

**Solutions**:

```bash
# Check rotation status
aws secretsmanager describe-secret \
  --secret-id <secret-id>

# View rotation Lambda logs
aws logs tail /aws/lambda/<rotation-function> --follow

# Force service restart to pick up new secrets
aws ecs update-service \
  --cluster <cluster-name> \
  --service <service-name> \
  --force-new-deployment
```

## Debugging Tools

### CloudWatch Logs Insights

```sql
# Find errors in last hour
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100

# Count errors by service
fields @message
| filter @message like /ERROR/
| stats count() by service
```

### ECS Exec

```bash
# Connect to running container
aws ecs execute-command \
  --cluster <cluster-name> \
  --task <task-id> \
  --container <container-name> \
  --interactive \
  --command "/bin/bash"
```

### X-Ray Tracing

```bash
# View service map
aws xray get-service-graph \
  --start-time <start> \
  --end-time <end>

# Get trace details
aws xray batch-get-traces \
  --trace-ids <trace-id>
```

## Performance Optimization

### Database Optimization

- Add indexes for frequently queried columns
- Use connection pooling
- Enable query caching
- Optimize N+1 queries

### Redis Optimization

- Use pipelining for multiple commands
- Set appropriate TTL values
- Use Redis Cluster for high throughput
- Monitor memory usage

### Application Optimization

- Enable gzip compression
- Implement caching strategies
- Use CDN for static assets
- Optimize bundle sizes

## Getting Help

1. Check CloudWatch Logs first
2. Review this troubleshooting guide
3. Check AWS service health dashboard
4. Review recent deployments
5. Contact DevOps team

## Useful Commands

```bash
# Quick health check
./scripts/utils/check-all-services.sh

# View all logs
./scripts/utils/comprehensive-audit.sh

# Rollback deployment
./scripts/deploy/rollback.sh <version>

# Run smoke tests
./scripts/test/smoke-tests.sh
```
