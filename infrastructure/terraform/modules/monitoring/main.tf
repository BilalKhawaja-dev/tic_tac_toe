# Monitoring Infrastructure Module
# Creates CloudWatch dashboards, X-Ray tracing, SNS topics, and centralized logging

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# CloudWatch Log Groups for different services
resource "aws_cloudwatch_log_group" "ecs_game_engine" {
  name              = "/aws/ecs/${var.project_name}/game-engine"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(var.tags, {
    Name    = "${var.project_name}-game-engine-logs"
    Service = "game-engine"
  })
}

resource "aws_cloudwatch_log_group" "ecs_user_service" {
  name              = "/aws/ecs/${var.project_name}/user-service"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(var.tags, {
    Name    = "${var.project_name}-user-service-logs"
    Service = "user-service"
  })
}

resource "aws_cloudwatch_log_group" "ecs_leaderboard_service" {
  name              = "/aws/ecs/${var.project_name}/leaderboard-service"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(var.tags, {
    Name    = "${var.project_name}-leaderboard-service-logs"
    Service = "leaderboard-service"
  })
}

resource "aws_cloudwatch_log_group" "ecs_support_service" {
  name              = "/aws/ecs/${var.project_name}/support-service"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(var.tags, {
    Name    = "${var.project_name}-support-service-logs"
    Service = "support-service"
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.project_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(var.tags, {
    Name    = "${var.project_name}-lambda-logs"
    Service = "lambda"
  })
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(var.tags, {
    Name    = "${var.project_name}-api-gateway-logs"
    Service = "api-gateway"
  })
}

# X-Ray Tracing
resource "aws_xray_sampling_rule" "main" {
  rule_name      = "ggp-${var.environment}-sampling"
  priority       = 9000
  version        = 1
  reservoir_size = 1
  fixed_rate     = var.xray_sampling_rate
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  tags = var.tags
}

# SNS Topics for Alerts
resource "aws_sns_topic" "critical_alerts" {
  name              = "${var.project_name}-critical-alerts"
  kms_master_key_id = var.kms_key_arn

  tags = merge(var.tags, {
    Name     = "${var.project_name}-critical-alerts"
    Severity = "critical"
  })
}

resource "aws_sns_topic" "warning_alerts" {
  name              = "${var.project_name}-warning-alerts"
  kms_master_key_id = var.kms_key_arn

  tags = merge(var.tags, {
    Name     = "${var.project_name}-warning-alerts"
    Severity = "warning"
  })
}

resource "aws_sns_topic" "info_alerts" {
  name              = "${var.project_name}-info-alerts"
  kms_master_key_id = var.kms_key_arn

  tags = merge(var.tags, {
    Name     = "${var.project_name}-info-alerts"
    Severity = "info"
  })
}

# SNS Topic Subscriptions (Email)
resource "aws_sns_topic_subscription" "critical_email" {
  count     = length(var.critical_alert_emails)
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.critical_alert_emails[count.index]
}

resource "aws_sns_topic_subscription" "warning_email" {
  count     = length(var.warning_alert_emails)
  topic_arn = aws_sns_topic.warning_alerts.arn
  protocol  = "email"
  endpoint  = var.warning_alert_emails[count.index]
}

# Lambda function for alert processing
resource "aws_lambda_function" "alert_processor" {
  filename         = data.archive_file.alert_processor.output_path
  function_name    = "${var.project_name}-alert-processor"
  role             = aws_iam_role.alert_processor_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.alert_processor.output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
      TEAMS_WEBHOOK_URL = var.teams_webhook_url
      PROJECT_NAME      = var.project_name
    }
  }

  tags = var.tags
}

# Archive file for alert processor Lambda
data "archive_file" "alert_processor" {
  type        = "zip"
  output_path = "${path.module}/alert_processor.zip"
  source {
    content  = file("${path.module}/lambda/alert_processor.js")
    filename = "index.js"
  }
}

# IAM Role for Alert Processor Lambda
resource "aws_iam_role" "alert_processor_lambda" {
  name = "${var.project_name}-alert-processor-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for Alert Processor Lambda
resource "aws_iam_role_policy" "alert_processor_lambda" {
  name = "${var.project_name}-alert-processor-lambda-policy"
  role = aws_iam_role.alert_processor_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.critical_alerts.arn,
          aws_sns_topic.warning_alerts.arn,
          aws_sns_topic.info_alerts.arn
        ]
      }
    ]
  })
}

# SNS Topic Subscription for Lambda
resource "aws_sns_topic_subscription" "critical_lambda" {
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.alert_processor.arn
}

resource "aws_sns_topic_subscription" "warning_lambda" {
  topic_arn = aws_sns_topic.warning_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.alert_processor.arn
}

# Lambda Permission for SNS
resource "aws_lambda_permission" "allow_sns_critical" {
  statement_id  = "AllowExecutionFromSNSCritical"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_processor.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.critical_alerts.arn
}

resource "aws_lambda_permission" "allow_sns_warning" {
  statement_id  = "AllowExecutionFromSNSWarning"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_processor.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.warning_alerts.arn
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "${var.project_name}-alb"],
            [".", "TargetResponseTime", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Application Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${var.project_name}-game-engine", "ClusterName", "${var.project_name}-cluster"],
            [".", "MemoryUtilization", ".", ".", ".", "."],
            [".", "CPUUtilization", "ServiceName", "${var.project_name}-user-service", "ClusterName", "${var.project_name}-cluster"],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "ECS Service Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBClusterIdentifier", "${var.project_name}-aurora-cluster"],
            [".", "DatabaseConnections", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "RDS Aurora Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${var.project_name}-redis"],
            [".", "CacheHits", ".", "."],
            [".", "CacheMisses", ".", "."],
            [".", "NetworkBytesIn", ".", "."],
            [".", "NetworkBytesOut", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "ElastiCache Redis Metrics"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6

        properties = {
          query  = "SOURCE '/aws/ecs/${var.project_name}/game-engine' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100"
          region = data.aws_region.current.name
          title  = "Recent Errors"
          view   = "table"
        }
      }
    ]
  })
}

# Custom Metrics Namespace
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "${var.project_name}-error-count"
  log_group_name = aws_cloudwatch_log_group.ecs_game_engine.name
  pattern        = "ERROR"

  metric_transformation {
    name      = "ErrorCount"
    namespace = "${var.project_name}/Application"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "game_started" {
  name           = "${var.project_name}-games-started"
  log_group_name = aws_cloudwatch_log_group.ecs_game_engine.name
  pattern        = "GAME_STARTED"

  metric_transformation {
    name      = "GamesStarted"
    namespace = "${var.project_name}/Business"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "game_completed" {
  name           = "${var.project_name}-games-completed"
  log_group_name = aws_cloudwatch_log_group.ecs_game_engine.name
  pattern        = "GAME_COMPLETED"

  metric_transformation {
    name      = "GamesCompleted"
    namespace = "${var.project_name}/Business"
    value     = "1"
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.project_name}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorCount"
  namespace           = "${var.project_name}/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors application error rate"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_high_response_time" {
  alarm_name          = "${var.project_name}-alb-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1.0"
  alarm_description   = "This metric monitors ALB response time"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]

  dimensions = {
    LoadBalancer = "${var.project_name}-alb"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_high_cpu" {
  alarm_name          = "${var.project_name}-ecs-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]

  dimensions = {
    ServiceName = "${var.project_name}-game-engine"
    ClusterName = "${var.project_name}-cluster"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  alarm_name          = "${var.project_name}-rds-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]

  dimensions = {
    DBClusterIdentifier = "${var.project_name}-aurora-cluster"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_high_connections" {
  alarm_name          = "${var.project_name}-rds-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS connection count"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]

  dimensions = {
    DBClusterIdentifier = "${var.project_name}-aurora-cluster"
  }

  tags = var.tags
}

# CloudWatch Composite Alarm for System Health
resource "aws_cloudwatch_composite_alarm" "system_health" {
  alarm_name        = "${var.project_name}-system-health"
  alarm_description = "Composite alarm for overall system health"

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.high_error_rate.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.alb_high_response_time.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.ecs_high_cpu.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.rds_high_cpu.alarm_name})"
  ])

  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.info_alerts.arn]

  tags = var.tags
}