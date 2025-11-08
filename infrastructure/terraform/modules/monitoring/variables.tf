# Variables for Monitoring Infrastructure Module

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "global-gaming-platform"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "global-gaming-platform"
    ManagedBy = "terraform"
    Component = "monitoring"
  }
}

# KMS Configuration
variable "kms_key_arn" {
  description = "ARN of the KMS key for log encryption"
  type        = string
}

# CloudWatch Configuration
variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period."
  }
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

# X-Ray Configuration
variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing"
  type        = bool
  default     = true
}

variable "xray_sampling_rate" {
  description = "X-Ray sampling rate (0.0 to 1.0)"
  type        = number
  default     = 0.1

  validation {
    condition     = var.xray_sampling_rate >= 0.0 && var.xray_sampling_rate <= 1.0
    error_message = "X-Ray sampling rate must be between 0.0 and 1.0."
  }
}

# Alert Configuration
variable "critical_alert_emails" {
  description = "List of email addresses for critical alerts"
  type        = list(string)
  default     = []
}

variable "warning_alert_emails" {
  description = "List of email addresses for warning alerts"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "teams_webhook_url" {
  description = "Microsoft Teams webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

# Alarm Thresholds
variable "alarm_thresholds" {
  description = "Thresholds for various CloudWatch alarms"
  type = object({
    error_rate_threshold           = number
    response_time_threshold        = number
    cpu_utilization_threshold      = number
    memory_utilization_threshold   = number
    database_cpu_threshold         = number
    database_connections_threshold = number
    cache_cpu_threshold            = number
    disk_space_threshold           = number
  })
  default = {
    error_rate_threshold           = 10
    response_time_threshold        = 1.0
    cpu_utilization_threshold      = 80
    memory_utilization_threshold   = 80
    database_cpu_threshold         = 80
    database_connections_threshold = 80
    cache_cpu_threshold            = 80
    disk_space_threshold           = 85
  }
}

# Dashboard Configuration
variable "enable_custom_dashboard" {
  description = "Enable custom CloudWatch dashboard"
  type        = bool
  default     = true
}

variable "dashboard_widgets" {
  description = "Configuration for dashboard widgets"
  type = object({
    include_business_metrics = bool
    include_security_metrics = bool
    include_cost_metrics     = bool
  })
  default = {
    include_business_metrics = true
    include_security_metrics = true
    include_cost_metrics     = false
  }
}

# Log Analysis Configuration
variable "enable_log_insights" {
  description = "Enable CloudWatch Logs Insights queries"
  type        = bool
  default     = true
}

variable "log_metric_filters" {
  description = "Configuration for log metric filters"
  type = list(object({
    name        = string
    pattern     = string
    metric_name = string
    namespace   = string
    value       = string
    log_group   = string
  }))
  default = []
}

# Performance Monitoring
variable "enable_application_insights" {
  description = "Enable CloudWatch Application Insights"
  type        = bool
  default     = false
}

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights for ECS"
  type        = bool
  default     = true
}

# Cost Monitoring
variable "enable_cost_anomaly_detection" {
  description = "Enable AWS Cost Anomaly Detection"
  type        = bool
  default     = false
}

variable "cost_anomaly_threshold" {
  description = "Threshold for cost anomaly detection (USD)"
  type        = number
  default     = 100
}

# Synthetic Monitoring
variable "enable_synthetics" {
  description = "Enable CloudWatch Synthetics for endpoint monitoring"
  type        = bool
  default     = false
}

variable "synthetic_canary_endpoints" {
  description = "List of endpoints to monitor with synthetic canaries"
  type        = list(string)
  default     = []
}

# Event Monitoring
variable "enable_eventbridge_monitoring" {
  description = "Enable EventBridge rule monitoring"
  type        = bool
  default     = true
}

# Security Monitoring
variable "enable_security_monitoring" {
  description = "Enable security-related monitoring and alerting"
  type        = bool
  default     = true
}

variable "security_alert_patterns" {
  description = "Log patterns that trigger security alerts"
  type        = list(string)
  default = [
    "UNAUTHORIZED",
    "FORBIDDEN",
    "AUTHENTICATION_FAILED",
    "SUSPICIOUS_ACTIVITY",
    "BRUTE_FORCE"
  ]
}