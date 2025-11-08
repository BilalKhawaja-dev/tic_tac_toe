# Caching Layer - ElastiCache and DAX

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-cache-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-cache-subnet-group"
    Type = "cache"
  })
}

# ElastiCache Parameter Group for Redis 7
resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7"
  name   = "${var.project_name}-redis-params"

  # Performance and memory optimization parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxclients"
    value = "10000"
  }

  tags = var.tags
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-redis"
  description          = "Redis cluster for ${var.project_name}"

  # Engine configuration
  engine               = "redis"
  engine_version       = var.redis_engine_version
  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  # Cluster configuration
  num_cache_clusters = var.redis_num_cache_nodes

  # Multi-AZ configuration
  multi_az_enabled           = var.redis_multi_az_enabled
  automatic_failover_enabled = var.redis_automatic_failover_enabled

  # Network configuration
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.elasticache_security_group_id]

  # Security configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token
  kms_key_id                 = var.redis_kms_key_arn

  # Backup configuration
  snapshot_retention_limit = var.redis_snapshot_retention_limit
  snapshot_window          = var.redis_snapshot_window

  # Maintenance configuration
  maintenance_window = var.redis_maintenance_window

  # Notification configuration
  notification_topic_arn = var.warning_sns_topic_arn

  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-redis"
    Type = "cache"
  })
}

# CloudWatch Log Group for Redis slow log
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/redis/${var.project_name}/slow-log"
  retention_in_days = var.redis_log_retention_days
  kms_key_id        = var.redis_kms_key_arn

  tags = var.tags
}

# DAX Subnet Group
resource "aws_dax_subnet_group" "main" {
  name       = "${var.project_name}-dax-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-dax-subnet-group"
    Type = "dax"
  })
}

# DAX Parameter Group
resource "aws_dax_parameter_group" "main" {
  name = "${var.project_name}-dax-params"

  # Performance parameters
  parameters = [
    {
      name  = "query-ttl-millis"
      value = "300000" # 5 minutes
    },
    {
      name  = "record-ttl-millis"
      value = "300000" # 5 minutes
    }
  ]

  tags = var.tags
}

# IAM Role for DAX
resource "aws_iam_role" "dax" {
  name = "${var.project_name}-dax-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "dax.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for DAX
resource "aws_iam_role_policy" "dax" {
  name = "${var.project_name}-dax-policy"
  role = aws_iam_role.dax.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeTable",
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:ConditionCheckItem"
        ]
        Resource = [
          aws_dynamodb_table.games.arn,
          aws_dynamodb_table.game_moves.arn,
          aws_dynamodb_table.leaderboard.arn,
          aws_dynamodb_table.user_sessions.arn,
          "${aws_dynamodb_table.games.arn}/index/*",
          "${aws_dynamodb_table.game_moves.arn}/index/*",
          "${aws_dynamodb_table.leaderboard.arn}/index/*",
          "${aws_dynamodb_table.user_sessions.arn}/index/*"
        ]
      }
    ]
  })
}

# DAX Cluster
resource "aws_dax_cluster" "main" {
  cluster_name       = "${var.project_name}-dax"
  iam_role_arn       = aws_iam_role.dax.arn
  node_type          = var.dax_node_type
  replication_factor = var.dax_replication_factor

  # Network configuration
  subnet_group_name  = aws_dax_subnet_group.main.name
  security_group_ids = [var.dax_security_group_id]

  # Parameter group
  parameter_group_name = aws_dax_parameter_group.main.name

  # Maintenance window
  maintenance_window = var.dax_maintenance_window

  # Notification configuration
  notification_topic_arn = var.warning_sns_topic_arn

  # Server-side encryption
  server_side_encryption {
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-dax"
    Type = "dax-cache"
  })
}

# CloudWatch Alarms for ElastiCache
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "${var.project_name}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Redis CPU utilization"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.replication_group_id}-001"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "${var.project_name}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Redis memory utilization"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.replication_group_id}-001"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  alarm_name          = "${var.project_name}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Sum"
  threshold           = "100"
  alarm_description   = "This metric monitors Redis evictions"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.replication_group_id}-001"
  }

  tags = var.tags
}

# CloudWatch Alarms for DAX
resource "aws_cloudwatch_metric_alarm" "dax_error_rate" {
  alarm_name          = "${var.project_name}-dax-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorRequestCount"
  namespace           = "AWS/DAX"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors DAX error rate"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    ClusterName = aws_dax_cluster.main.cluster_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dax_throttle_events" {
  alarm_name          = "${var.project_name}-dax-throttle-events"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ThrottledRequestCount"
  namespace           = "AWS/DAX"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors DAX throttle events"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    ClusterName = aws_dax_cluster.main.cluster_name
  }

  tags = var.tags
}