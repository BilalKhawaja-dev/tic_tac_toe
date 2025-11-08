# Monitoring Infrastructure Module

This Terraform module creates a comprehensive monitoring and observability infrastructure for the Global Gaming Platform, implementing CloudWatch dashboards, X-Ray tracing, SNS alerting, and centralized logging.

## Architecture

### Observability Stack

1. **Centralized Logging** - CloudWatch Logs with structured log groups
2. **Metrics and Monitoring** - CloudWatch metrics with custom namespaces
3. **Distributed Tracing** - X-Ray tracing for request flow analysis
4. **Alerting and Notifications** - SNS topics with multi-channel delivery
5. **Dashboards** - Real-time visualization of system health and business metrics

### Monitoring Layers

- **Infrastructure Monitoring** - ECS, RDS, ElastiCache, ALB metrics
- **Application Monitoring** - Custom business metrics and error tracking
- **Security Monitoring** - Authentication failures and suspicious activity
- **Performance Monitoring** - Response times, throughput, and latency
- **Cost Monitoring** - AWS service costs and budget tracking

## Components

### CloudWatch Log Groups

- **ECS Services** - Separate log groups for each microservice
- **Lambda Functions** - Centralized Lambda logging
- **API Gateway** - API request and response logging
- **Structured Logging** - JSON format with correlation IDs

### X-Ray Tracing

- **Sampling Rules** - Configurable sampling rate for cost optimization
- **Service Map** - Visual representation of service dependencies
- **Trace Analysis** - Request flow and performance bottleneck identification

### SNS Alert Topics

- **Critical Alerts** - System failures and security incidents
- **Warning Alerts** - Performance degradation and resource constraints
- **Info Alerts** - System state changes and maintenance notifications

### CloudWatch Dashboards

- **System Overview** - High-level system health and performance
- **Business Metrics** - Game activity, user engagement, and feature usage
- **Security Metrics** - Authentication events and security incidents
- **Performance Metrics** - Response times, throughput, and error rates

### Alert Processing

- **Lambda Function** - Intelligent alert processing and routing
- **Multi-Channel Delivery** - Email, Slack, and Microsoft Teams integration
- **Alert Enrichment** - Context-aware notifications with severity classification

## Usage

### Basic Usage

```hcl
module "monitoring" {
  source = "./modules/monitoring"

  project_name = "global-gaming-platform"
  environment  = "production"
  kms_key_arn  = module.security.main_kms_key_arn

  # Alert configuration
  critical_alert_emails = ["ops-team@company.com"]
  warning_alert_emails  = ["dev-team@company.com"]

  tags = {
    Project     = "global-gaming-platform"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

### Advanced Configuration

```hcl
module "monitoring" {
  source = "./modules/monitoring"

  project_name = "global-gaming-platform"
  environment  = "production"
  kms_key_arn  = module.security.main_kms_key_arn

  # Log configuration
  log_retention_days = 90
  enable_detailed_monitoring = true

  # X-Ray configuration
  enable_xray_tracing = true
  xray_sampling_rate  = 0.1

  # Alert configuration
  critical_alert_emails = ["ops-team@company.com", "cto@company.com"]
  warning_alert_emails  = ["dev-team@company.com"]
  slack_webhook_url     = var.slack_webhook_url
  teams_webhook_url     = var.teams_webhook_url

  # Custom alarm thresholds
  alarm_thresholds = {
    error_rate_threshold           = 5
    response_time_threshold        = 0.5
    cpu_utilization_threshold      = 70
    memory_utilization_threshold   = 75
    database_cpu_threshold         = 70
    database_connections_threshold = 70
    cache_cpu_threshold           = 70
    disk_space_threshold          = 80
  }

  # Dashboard configuration
  enable_custom_dashboard = true
  dashboard_widgets = {
    include_business_metrics = true
    include_security_metrics = true
    include_cost_metrics     = true
  }

  # Advanced features
  enable_log_insights           = true
  enable_container_insights     = true
  enable_eventbridge_monitoring = true
  enable_security_monitoring    = true

  tags = {
    Project     = "global-gaming-platform"
    Environment = "production"
    ManagedBy   = "terraform"
    Component   = "monitoring"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| project_name | Name of the project | `string` | `"global-gaming-platform"` | no |
| environment | Environment name | `string` | n/a | yes |
| kms_key_arn | ARN of KMS key for log encryption | `string` | n/a | yes |
| log_retention_days | CloudWatch log retention period | `number` | `30` | no |
| xray_sampling_rate | X-Ray sampling rate (0.0-1.0) | `number` | `0.1` | no |
| critical_alert_emails | Email addresses for critical alerts | `list(string)` | `[]` | no |
| warning_alert_emails | Email addresses for warning alerts | `list(string)` | `[]` | no |
| slack_webhook_url | Slack webhook URL | `string` | `""` | no |
| teams_webhook_url | Teams webhook URL | `string` | `""` | no |
| alarm_thresholds | Alarm threshold configuration | `object` | See variables.tf | no |
| tags | Tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

### Log Groups
- `log_group_names` - Names of all CloudWatch log groups
- `log_group_arns` - ARNs of all CloudWatch log groups

### SNS Topics
- `sns_topic_arns` - ARNs of SNS alert topics
- `sns_topic_names` - Names of SNS alert topics

### Dashboards
- `dashboard_name` - Name of the main CloudWatch dashboard
- `dashboard_url` - URL to access the dashboard

### Alarms
- `alarm_names` - Names of all CloudWatch alarms
- `alarm_arns` - ARNs of all CloudWatch alarms

## Monitoring Features

### Application Metrics

- **Game Activity** - Games started, completed, active users
- **User Engagement** - Session duration, retention rates
- **Feature Usage** - Leaderboard updates, social logins
- **Error Tracking** - Application errors and exceptions

### Infrastructure Metrics

- **ECS Services** - CPU, memory, task count, service health
- **Load Balancer** - Request count, response time, error rates
- **Database** - CPU, connections, read/write latency
- **Cache** - CPU, hit/miss ratio, memory usage

### Security Metrics

- **Authentication** - Login attempts, failures, suspicious activity
- **Access Control** - Unauthorized access attempts
- **WAF** - Blocked requests, allowed requests
- **Audit Events** - CloudTrail log analysis

### Performance Metrics

- **Response Times** - API endpoint performance
- **Throughput** - Requests per second, concurrent users
- **Error Rates** - 4xx and 5xx error percentages
- **Availability** - Service uptime and health checks

## Alerting Strategy

### Alert Severity Levels

1. **Critical** - System failures, security breaches, data loss
2. **Warning** - Performance degradation, resource constraints
3. **Info** - System state changes, maintenance notifications

### Alert Channels

- **Email** - Immediate notification for critical issues
- **Slack** - Team collaboration and incident coordination
- **Microsoft Teams** - Enterprise communication integration
- **Lambda Processing** - Intelligent alert routing and enrichment

### Alert Thresholds

```hcl
# Production thresholds
alarm_thresholds = {
  error_rate_threshold           = 5     # 5 errors per 5 minutes
  response_time_threshold        = 0.5   # 500ms average response time
  cpu_utilization_threshold      = 70    # 70% CPU utilization
  memory_utilization_threshold   = 75    # 75% memory utilization
  database_cpu_threshold         = 70    # 70% database CPU
  database_connections_threshold = 70    # 70% of max connections
  cache_cpu_threshold           = 70     # 70% cache CPU
  disk_space_threshold          = 80     # 80% disk usage
}
```

## Dashboard Configuration

### System Overview Dashboard

- Load balancer metrics (requests, response time, errors)
- ECS service metrics (CPU, memory, task count)
- Database metrics (CPU, connections, latency)
- Cache metrics (CPU, hit ratio, memory)
- Recent error logs

### Business Metrics Dashboard

- Game activity (started, completed, active users)
- User engagement (session duration, retention)
- Feature usage (leaderboard, social login)
- Revenue metrics (if applicable)

### Security Dashboard

- Authentication events (successes, failures)
- WAF metrics (blocked/allowed requests)
- Security incidents and alerts
- Audit log analysis

### Performance Dashboard

- X-Ray tracing metrics
- API Gateway performance
- Service response times
- Error rate trends

## Log Analysis

### CloudWatch Logs Insights Queries

```sql
-- Error analysis
fields @timestamp, @message 
| filter @message like /ERROR/ 
| sort @timestamp desc 
| limit 100

-- Performance analysis
fields @timestamp, @duration 
| filter @type = "REPORT" 
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)

-- Game metrics
fields @timestamp, @message 
| filter @message like /GAME_/ 
| stats count() by bin(1h)

-- User activity
fields @timestamp, @message 
| filter @message like /USER_/ 
| stats count() by bin(1h)
```

### Custom Metric Filters

- **Error Count** - Count of ERROR log entries
- **Games Started** - Count of GAME_STARTED events
- **Games Completed** - Count of GAME_COMPLETED events
- **Security Events** - Count of security-related log entries

## X-Ray Tracing

### Service Map

- Visual representation of service dependencies
- Request flow between microservices
- Performance bottleneck identification
- Error propagation analysis

### Trace Analysis

- End-to-end request tracing
- Service response time breakdown
- Database query performance
- External API call latency

### Sampling Configuration

```hcl
# Cost-optimized sampling
xray_sampling_rate = 0.1  # 10% of requests

# High-visibility sampling (development)
xray_sampling_rate = 1.0  # 100% of requests
```

## Cost Optimization

### Development/Staging

```hcl
# Reduced monitoring for non-production
log_retention_days = 7
xray_sampling_rate = 0.05
enable_detailed_monitoring = false
dashboard_widgets = {
  include_business_metrics = false
  include_security_metrics = false
  include_cost_metrics     = false
}
```

### Production

```hcl
# Full monitoring for production
log_retention_days = 90
xray_sampling_rate = 0.1
enable_detailed_monitoring = true
dashboard_widgets = {
  include_business_metrics = true
  include_security_metrics = true
  include_cost_metrics     = true
}
```

## Integration with Other Modules

### Network Module Integration

```hcl
# VPC Flow Logs monitoring
log_group_name = module.network.vpc_flow_log_group_name
```

### Security Module Integration

```hcl
# KMS encryption for logs
kms_key_arn = module.security.main_kms_key_arn

# CloudTrail log monitoring
cloudtrail_log_group = module.security.cloudtrail_log_group_name
```

### Application Integration

```hcl
# ECS task definition logging
log_group = module.monitoring.log_group_names.game_engine
log_driver = "awslogs"

# X-Ray tracing
tracing_config {
  mode = "Active"
}
```

## Best Practices Implemented

1. **Structured Logging** - JSON format with correlation IDs
2. **Metric Namespacing** - Organized custom metrics
3. **Alert Fatigue Prevention** - Intelligent thresholds and grouping
4. **Cost Optimization** - Configurable retention and sampling
5. **Security Monitoring** - Comprehensive security event tracking
6. **Performance Monitoring** - End-to-end request tracing
7. **Business Intelligence** - Custom business metrics

## Troubleshooting

### Common Issues

1. **High CloudWatch costs**
   - Reduce log retention periods
   - Lower X-Ray sampling rate
   - Optimize metric filters

2. **Missing metrics**
   - Check IAM permissions
   - Verify metric namespace
   - Confirm log group configuration

3. **Alert fatigue**
   - Adjust alarm thresholds
   - Implement alert grouping
   - Use composite alarms

### Debugging Commands

```bash
# Check log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/ecs/global-gaming-platform"

# Query logs
aws logs start-query --log-group-name "/aws/ecs/global-gaming-platform/game-engine" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'

# Check X-Ray traces
aws xray get-trace-summaries --time-range-type TimeRangeByStartTime \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s)

# Test SNS topic
aws sns publish --topic-arn arn:aws:sns:region:account:topic-name \
  --message "Test alert message"
```

## Dependencies

- AWS Provider ~> 5.0
- Terraform >= 1.6.0
- Archive Provider (for Lambda functions)

## Security Considerations

- **Log Encryption** - All logs encrypted with KMS
- **SNS Encryption** - Alert topics encrypted at rest
- **IAM Permissions** - Least privilege for monitoring resources
- **Sensitive Data** - No sensitive information in logs or metrics