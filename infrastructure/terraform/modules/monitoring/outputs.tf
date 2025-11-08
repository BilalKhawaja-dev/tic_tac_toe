# Outputs for Monitoring Infrastructure Module

# CloudWatch Log Groups
output "log_group_names" {
  description = "Names of all CloudWatch log groups"
  value = {
    game_engine         = aws_cloudwatch_log_group.ecs_game_engine.name
    user_service        = aws_cloudwatch_log_group.ecs_user_service.name
    leaderboard_service = aws_cloudwatch_log_group.ecs_leaderboard_service.name
    support_service     = aws_cloudwatch_log_group.ecs_support_service.name
    lambda              = aws_cloudwatch_log_group.lambda.name
    api_gateway         = aws_cloudwatch_log_group.api_gateway.name
  }
}

output "log_group_arns" {
  description = "ARNs of all CloudWatch log groups"
  value = {
    game_engine         = aws_cloudwatch_log_group.ecs_game_engine.arn
    user_service        = aws_cloudwatch_log_group.ecs_user_service.arn
    leaderboard_service = aws_cloudwatch_log_group.ecs_leaderboard_service.arn
    support_service     = aws_cloudwatch_log_group.ecs_support_service.arn
    lambda              = aws_cloudwatch_log_group.lambda.arn
    api_gateway         = aws_cloudwatch_log_group.api_gateway.arn
  }
}

# X-Ray
output "xray_sampling_rule_name" {
  description = "Name of the X-Ray sampling rule"
  value       = aws_xray_sampling_rule.main.rule_name
}

output "xray_sampling_rule_arn" {
  description = "ARN of the X-Ray sampling rule"
  value       = aws_xray_sampling_rule.main.arn
}

# SNS Topics
output "sns_topic_arns" {
  description = "ARNs of SNS topics for alerts"
  value = {
    critical = aws_sns_topic.critical_alerts.arn
    warning  = aws_sns_topic.warning_alerts.arn
    info     = aws_sns_topic.info_alerts.arn
  }
}

output "sns_topic_names" {
  description = "Names of SNS topics for alerts"
  value = {
    critical = aws_sns_topic.critical_alerts.name
    warning  = aws_sns_topic.warning_alerts.name
    info     = aws_sns_topic.info_alerts.name
  }
}

# Lambda Function
output "alert_processor_function_name" {
  description = "Name of the alert processor Lambda function"
  value       = aws_lambda_function.alert_processor.function_name
}

output "alert_processor_function_arn" {
  description = "ARN of the alert processor Lambda function"
  value       = aws_lambda_function.alert_processor.arn
}

# CloudWatch Dashboard
output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

# CloudWatch Alarms
output "alarm_names" {
  description = "Names of all CloudWatch alarms"
  value = {
    high_error_rate        = aws_cloudwatch_metric_alarm.high_error_rate.alarm_name
    alb_high_response_time = aws_cloudwatch_metric_alarm.alb_high_response_time.alarm_name
    ecs_high_cpu           = aws_cloudwatch_metric_alarm.ecs_high_cpu.alarm_name
    rds_high_cpu           = aws_cloudwatch_metric_alarm.rds_high_cpu.alarm_name
    rds_high_connections   = aws_cloudwatch_metric_alarm.rds_high_connections.alarm_name
    system_health          = aws_cloudwatch_composite_alarm.system_health.alarm_name
  }
}

output "alarm_arns" {
  description = "ARNs of all CloudWatch alarms"
  value = {
    high_error_rate        = aws_cloudwatch_metric_alarm.high_error_rate.arn
    alb_high_response_time = aws_cloudwatch_metric_alarm.alb_high_response_time.arn
    ecs_high_cpu           = aws_cloudwatch_metric_alarm.ecs_high_cpu.arn
    rds_high_cpu           = aws_cloudwatch_metric_alarm.rds_high_cpu.arn
    rds_high_connections   = aws_cloudwatch_metric_alarm.rds_high_connections.arn
    system_health          = aws_cloudwatch_composite_alarm.system_health.arn
  }
}

# Custom Metrics
output "custom_metric_filters" {
  description = "Names of custom metric filters"
  value = {
    error_count     = aws_cloudwatch_log_metric_filter.error_count.name
    games_started   = aws_cloudwatch_log_metric_filter.game_started.name
    games_completed = aws_cloudwatch_log_metric_filter.game_completed.name
  }
}

# Monitoring Summary
output "monitoring_summary" {
  description = "Summary of monitoring configuration"
  value = {
    log_groups_created   = 6
    sns_topics_created   = 3
    alarms_created       = 6
    dashboard_created    = true
    xray_tracing_enabled = true
    custom_metrics       = 3
    alert_processor      = true
  }
}

# Integration Points
output "integration_points" {
  description = "Key integration points for other modules"
  value = {
    log_groups = {
      game_engine         = aws_cloudwatch_log_group.ecs_game_engine.name
      user_service        = aws_cloudwatch_log_group.ecs_user_service.name
      leaderboard_service = aws_cloudwatch_log_group.ecs_leaderboard_service.name
      support_service     = aws_cloudwatch_log_group.ecs_support_service.name
      lambda              = aws_cloudwatch_log_group.lambda.name
      api_gateway         = aws_cloudwatch_log_group.api_gateway.name
    }
    alert_topics = {
      critical = aws_sns_topic.critical_alerts.arn
      warning  = aws_sns_topic.warning_alerts.arn
      info     = aws_sns_topic.info_alerts.arn
    }
    xray_sampling_rule = aws_xray_sampling_rule.main.rule_name
  }
}

# CloudWatch Insights Queries
output "sample_log_insights_queries" {
  description = "Sample CloudWatch Logs Insights queries"
  value = {
    error_analysis       = "fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100"
    performance_analysis = "fields @timestamp, @duration | filter @type = \"REPORT\" | stats avg(@duration), max(@duration), min(@duration) by bin(5m)"
    game_metrics         = "fields @timestamp, @message | filter @message like /GAME_/ | stats count() by bin(1h)"
    user_activity        = "fields @timestamp, @message | filter @message like /USER_/ | stats count() by bin(1h)"
  }
}

# Alerting Configuration
output "alerting_configuration" {
  description = "Current alerting configuration"
  value = {
    email_subscriptions = {
      critical = length(var.critical_alert_emails)
      warning  = length(var.warning_alert_emails)
    }
    webhook_integrations = {
      slack_enabled = var.slack_webhook_url != ""
      teams_enabled = var.teams_webhook_url != ""
    }
    alarm_thresholds = var.alarm_thresholds
  }
}