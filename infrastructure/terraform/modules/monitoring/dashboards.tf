# Additional CloudWatch Dashboards for specific monitoring needs

# Business Metrics Dashboard
resource "aws_cloudwatch_dashboard" "business_metrics" {
  count          = var.dashboard_widgets.include_business_metrics ? 1 : 0
  dashboard_name = "${var.project_name}-business-metrics"

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
            ["${var.project_name}/Business", "GamesStarted"],
            [".", "GamesCompleted"],
            [".", "ActiveUsers"],
            [".", "NewRegistrations"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Game Activity Metrics"
          period  = 300
          stat    = "Sum"
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
            ["${var.project_name}/Business", "GameDuration", { "stat" : "Average" }],
            [".", "SessionDuration", { "stat" : "Average" }],
            [".", "UserRetention", { "stat" : "Average" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "User Engagement Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 24
        height = 6

        properties = {
          metrics = [
            ["${var.project_name}/Business", "LeaderboardUpdates"],
            [".", "SocialLogins"],
            [".", "SupportTickets"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Feature Usage Metrics"
          period  = 300
          stat    = "Sum"
        }
      }
    ]
  })
}

# Security Metrics Dashboard
resource "aws_cloudwatch_dashboard" "security_metrics" {
  count          = var.dashboard_widgets.include_security_metrics ? 1 : 0
  dashboard_name = "${var.project_name}-security-metrics"

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
            ["${var.project_name}/Security", "AuthenticationFailures"],
            [".", "UnauthorizedAccess"],
            [".", "SuspiciousActivity"],
            [".", "BruteForceAttempts"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Security Events"
          period  = 300
          stat    = "Sum"
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
            ["AWS/WAF", "AllowedRequests", "WebACL", "${var.project_name}-waf", "Rule", "ALL"],
            [".", "BlockedRequests", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "WAF Metrics"
          period  = 300
          stat    = "Sum"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 6

        properties = {
          query  = "SOURCE '/aws/ecs/${var.project_name}/user-service' | fields @timestamp, @message | filter @message like /SECURITY/ | sort @timestamp desc | limit 50"
          region = data.aws_region.current.name
          title  = "Recent Security Events"
          view   = "table"
        }
      }
    ]
  })
}

# Performance Dashboard
resource "aws_cloudwatch_dashboard" "performance" {
  dashboard_name = "${var.project_name}-performance"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/X-Ray", "TracesReceived"],
            [".", "TracesProcessed"],
            [".", "LatencyHigh", "ServiceName", "${var.project_name}-game-engine"],
            [".", "LatencyLow", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "X-Ray Tracing Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "${var.project_name}-alb"],
            [".", "NewConnectionCount", ".", "."],
            [".", "ActiveConnectionCount", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Load Balancer Connections"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", "${var.project_name}-api"],
            [".", "Latency", ".", "."],
            [".", "4XXError", ".", "."],
            [".", "5XXError", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "API Gateway Metrics"
          period  = 300
        }
      }
    ]
  })
}

# Cost Monitoring Dashboard
resource "aws_cloudwatch_dashboard" "cost_metrics" {
  count          = var.dashboard_widgets.include_cost_metrics ? 1 : 0
  dashboard_name = "${var.project_name}-cost-metrics"

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
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD", "ServiceName", "AmazonEC2"],
            [".", ".", ".", ".", ".", "AmazonRDS"],
            [".", ".", ".", ".", ".", "AmazonDynamoDB"],
            [".", ".", ".", ".", ".", "AmazonElastiCache"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1" # Billing metrics are only in us-east-1
          title   = "Service Costs (USD)"
          period  = 86400 # Daily
          stat    = "Maximum"
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
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          title   = "Total Estimated Charges (USD)"
          period  = 86400
          stat    = "Maximum"
        }
      }
    ]
  })
}