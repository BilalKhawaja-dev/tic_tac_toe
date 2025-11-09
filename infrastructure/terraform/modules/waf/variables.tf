# WAF Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "rate_limit_per_5min" {
  description = "Maximum requests per IP per 5 minutes"
  type        = number
  default     = 2000
}

variable "enable_geo_blocking" {
  description = "Enable geographic blocking"
  type        = bool
  default     = false
}

variable "blocked_countries" {
  description = "List of country codes to block"
  type        = list(string)
  default     = []
}

variable "ip_whitelist" {
  description = "List of IP addresses to whitelist (CIDR notation)"
  type        = list(string)
  default     = []
}

variable "ip_blacklist" {
  description = "List of IP addresses to blacklist (CIDR notation)"
  type        = list(string)
  default     = []
}

variable "common_ruleset_exclusions" {
  description = "List of AWS Managed Rules to exclude from Common Rule Set"
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "Number of days to retain WAF logs"
  type        = number
  default     = 90
}

variable "kms_key_arn" {
  description = "KMS key ARN for log encryption"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for WAF alarms"
  type        = string
}

variable "blocked_requests_threshold" {
  description = "Threshold for blocked requests alarm"
  type        = number
  default     = 1000
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
