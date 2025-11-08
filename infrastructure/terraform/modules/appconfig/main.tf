# AWS AppConfig Module for Feature Flags and Configuration Management

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# AppConfig Application
resource "aws_appconfig_application" "gaming_platform" {
  name        = var.application_name
  description = "Global Gaming Platform configuration and feature flags"

  tags = var.tags
}

# AppConfig Environment for each deployment stage
resource "aws_appconfig_environment" "environments" {
  for_each = var.environments

  name           = each.key
  description    = "Configuration environment for ${each.key}"
  application_id = aws_appconfig_application.gaming_platform.id

  dynamic "monitor" {
    for_each = each.value.monitors
    content {
      alarm_arn      = monitor.value.alarm_arn
      alarm_role_arn = monitor.value.alarm_role_arn
    }
  }

  tags = var.tags
}

# Configuration Profile for Feature Flags
resource "aws_appconfig_configuration_profile" "feature_flags" {
  application_id = aws_appconfig_application.gaming_platform.id
  name           = "feature-flags"
  description    = "Feature flags for gradual rollouts and A/B testing"
  location_uri   = "hosted"
  type           = "AWS.AppConfig.FeatureFlags"

  tags = var.tags
}

# Configuration Profile for Application Settings
resource "aws_appconfig_configuration_profile" "app_settings" {
  application_id = aws_appconfig_application.gaming_platform.id
  name           = "application-settings"
  description    = "Application configuration settings"
  location_uri   = "hosted"

  validator {
    content = jsonencode({
      "$schema" = "http://json-schema.org/draft-07/schema#"
      type      = "object"
      properties = {
        database = {
          type = "object"
          properties = {
            connectionTimeout = { type = "integer", minimum = 1000, maximum = 30000 }
            maxConnections    = { type = "integer", minimum = 10, maximum = 1000 }
          }
          required = ["connectionTimeout", "maxConnections"]
        }
        api = {
          type = "object"
          properties = {
            rateLimitPerMinute = { type = "integer", minimum = 100, maximum = 10000 }
            timeoutMs          = { type = "integer", minimum = 1000, maximum = 30000 }
          }
          required = ["rateLimitPerMinute", "timeoutMs"]
        }
        game = {
          type = "object"
          properties = {
            maxConcurrentGames = { type = "integer", minimum = 1000, maximum = 100000 }
            moveTimeoutSeconds = { type = "integer", minimum = 30, maximum = 300 }
          }
          required = ["maxConcurrentGames", "moveTimeoutSeconds"]
        }
      }
      required = ["database", "api", "game"]
    })
    type = "JSON_SCHEMA"
  }

  tags = var.tags
}

# Hosted Configuration Version for Feature Flags
resource "aws_appconfig_hosted_configuration_version" "feature_flags_initial" {
  application_id           = aws_appconfig_application.gaming_platform.id
  configuration_profile_id = aws_appconfig_configuration_profile.feature_flags.configuration_profile_id
  description              = "Initial feature flags configuration"
  content_type             = "application/json"

  content = jsonencode({
    flags = {
      enableSocialLogin = {
        name    = "enableSocialLogin"
        enabled = true
        variants = {
          google   = { enabled = true }
          facebook = { enabled = true }
          twitter  = { enabled = false }
        }
      }
      enableLeaderboard = {
        name    = "enableLeaderboard"
        enabled = true
      }
      enableRealTimeUpdates = {
        name    = "enableRealTimeUpdates"
        enabled = true
      }
      enableAdvancedAnalytics = {
        name    = "enableAdvancedAnalytics"
        enabled = false
      }
      enableBetaFeatures = {
        name    = "enableBetaFeatures"
        enabled = false
      }
    }
    values = {
      enableSocialLogin       = { enabled = true }
      enableLeaderboard       = { enabled = true }
      enableRealTimeUpdates   = { enabled = true }
      enableAdvancedAnalytics = { enabled = false }
      enableBetaFeatures      = { enabled = false }
    }
    version = "1"
  })
}

# Hosted Configuration Version for Application Settings
resource "aws_appconfig_hosted_configuration_version" "app_settings_initial" {
  application_id           = aws_appconfig_application.gaming_platform.id
  configuration_profile_id = aws_appconfig_configuration_profile.app_settings.configuration_profile_id
  description              = "Initial application settings"
  content_type             = "application/json"

  content = jsonencode({
    database = {
      connectionTimeout = 5000
      maxConnections    = 100
    }
    api = {
      rateLimitPerMinute = 1000
      timeoutMs          = 5000
    }
    game = {
      maxConcurrentGames = 10000
      moveTimeoutSeconds = 120
    }
    monitoring = {
      metricsInterval = 60
      enableTracing   = true
    }
    security = {
      sessionTimeoutMinutes = 1440
      maxLoginAttempts      = 5
    }
  })
}

# Deployment Strategy
resource "aws_appconfig_deployment_strategy" "gradual_rollout" {
  name                           = "gradual-rollout"
  description                    = "Gradual rollout strategy for safe deployments"
  deployment_duration_in_minutes = 10
  final_bake_time_in_minutes     = 5
  growth_factor                  = 20.0
  growth_type                    = "EXPONENTIAL"
  replicate_to                   = "NONE"

  tags = var.tags
}

# Deployment Strategy for Immediate Rollout (Emergency)
resource "aws_appconfig_deployment_strategy" "immediate_rollout" {
  name                           = "immediate-rollout"
  description                    = "Immediate rollout for emergency configuration changes"
  deployment_duration_in_minutes = 0
  final_bake_time_in_minutes     = 0
  growth_factor                  = 100.0
  growth_type                    = "LINEAR"
  replicate_to                   = "NONE"

  tags = var.tags
}

# IAM Role for AppConfig
resource "aws_iam_role" "appconfig_role" {
  name = "${var.application_name}-appconfig-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "appconfig.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for AppConfig
resource "aws_iam_role_policy" "appconfig_policy" {
  name = "${var.application_name}-appconfig-policy"
  role = aws_iam_role.appconfig_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Alarms for Configuration Monitoring
resource "aws_cloudwatch_metric_alarm" "config_error_rate" {
  for_each = var.environments

  alarm_name          = "${var.application_name}-${each.key}-config-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ConfigurationRetrievalErrors"
  namespace           = "AWS/AppConfig"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors configuration retrieval errors"
  alarm_actions       = [aws_sns_topic.config_alerts.arn]

  dimensions = {
    Application = aws_appconfig_application.gaming_platform.name
    Environment = each.key
  }

  tags = var.tags
}

# SNS Topic for Configuration Alerts
resource "aws_sns_topic" "config_alerts" {
  name = "${var.application_name}-config-alerts"

  tags = var.tags
}

# Lambda Function for Configuration Change Notifications
resource "aws_lambda_function" "config_change_handler" {
  filename         = "config_change_handler.zip"
  function_name    = "${var.application_name}-config-change-handler"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.config_change_handler.output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30

  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.config_alerts.arn
    }
  }

  tags = var.tags
}

# Archive file for Lambda function
data "archive_file" "config_change_handler" {
  type        = "zip"
  output_path = "config_change_handler.zip"
  source {
    content = templatefile("${path.module}/lambda/config_change_handler.js", {
      sns_topic_arn = aws_sns_topic.config_alerts.arn
    })
    filename = "index.js"
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.application_name}-lambda-config-role"

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

# IAM Policy for Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.application_name}-lambda-config-policy"
  role = aws_iam_role.lambda_role.id

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
        Resource = aws_sns_topic.config_alerts.arn
      }
    ]
  })
}

# EventBridge Rule for Configuration Changes
resource "aws_cloudwatch_event_rule" "config_changes" {
  name        = "${var.application_name}-config-changes"
  description = "Capture AppConfig configuration changes"

  event_pattern = jsonencode({
    source      = ["aws.appconfig"]
    detail-type = ["AppConfig Configuration Deployment Completed"]
    detail = {
      applicationId = [aws_appconfig_application.gaming_platform.id]
    }
  })

  tags = var.tags
}

# EventBridge Target
resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.config_changes.name
  target_id = "ConfigChangeLambdaTarget"
  arn       = aws_lambda_function.config_change_handler.arn
}

# Lambda Permission for EventBridge
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.config_change_handler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.config_changes.arn
}