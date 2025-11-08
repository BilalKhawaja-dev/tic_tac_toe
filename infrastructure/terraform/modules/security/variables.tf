# Variables for Security Infrastructure Module

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
    Component = "security"
  }
}

# KMS Configuration
variable "kms_deletion_window" {
  description = "Number of days before KMS key deletion"
  type        = number
  default     = 7

  validation {
    condition     = var.kms_deletion_window >= 7 && var.kms_deletion_window <= 30
    error_message = "KMS deletion window must be between 7 and 30 days."
  }
}

# Secrets Manager Configuration
variable "secrets_recovery_window" {
  description = "Number of days for secrets recovery window"
  type        = number
  default     = 7

  validation {
    condition     = var.secrets_recovery_window >= 7 && var.secrets_recovery_window <= 30
    error_message = "Secrets recovery window must be between 7 and 30 days."
  }
}

# Database Credentials
variable "database_username" {
  description = "Database master username"
  type        = string
  default     = "gameadmin"
  sensitive   = true
}

variable "database_password" {
  description = "Database master password"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.database_password) >= 12
    error_message = "Database password must be at least 12 characters long."
  }
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "gamedb"
}

# Redis Configuration
variable "redis_auth_token" {
  description = "Redis authentication token"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.redis_auth_token) >= 16
    error_message = "Redis auth token must be at least 16 characters long."
  }
}

# JWT Configuration
variable "jwt_signing_key" {
  description = "JWT signing key"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.jwt_signing_key) >= 32
    error_message = "JWT signing key must be at least 32 characters long."
  }
}

# OAuth Configuration
variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "facebook_app_id" {
  description = "Facebook OAuth app ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "facebook_app_secret" {
  description = "Facebook OAuth app secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "twitter_api_key" {
  description = "Twitter OAuth API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "twitter_api_secret" {
  description = "Twitter OAuth API secret"
  type        = string
  default     = ""
  sensitive   = true
}

# CloudTrail Configuration
variable "cloudtrail_log_retention_days" {
  description = "Number of days to retain CloudTrail logs"
  type        = number
  default     = 2555 # 7 years for compliance

  validation {
    condition     = var.cloudtrail_log_retention_days >= 90
    error_message = "CloudTrail log retention must be at least 90 days for compliance."
  }
}

variable "enable_cloudtrail_insights" {
  description = "Enable CloudTrail Insights for anomaly detection"
  type        = bool
  default     = false
}

variable "enable_cloudtrail_data_events" {
  description = "Enable CloudTrail data events logging"
  type        = bool
  default     = true
}

# IAM Configuration
variable "enable_iam_access_analyzer" {
  description = "Enable IAM Access Analyzer"
  type        = bool
  default     = true
}

variable "password_policy" {
  description = "IAM password policy configuration"
  type = object({
    minimum_password_length        = number
    require_lowercase_characters   = bool
    require_uppercase_characters   = bool
    require_numbers                = bool
    require_symbols                = bool
    allow_users_to_change_password = bool
    max_password_age               = number
    password_reuse_prevention      = number
  })
  default = {
    minimum_password_length        = 14
    require_lowercase_characters   = true
    require_uppercase_characters   = true
    require_numbers                = true
    require_symbols                = true
    allow_users_to_change_password = true
    max_password_age               = 90
    password_reuse_prevention      = 12
  }
}

# Security Configuration
variable "enable_guardduty" {
  description = "Enable AWS GuardDuty"
  type        = bool
  default     = true
}

variable "enable_security_hub" {
  description = "Enable AWS Security Hub"
  type        = bool
  default     = true
}

variable "enable_config" {
  description = "Enable AWS Config"
  type        = bool
  default     = true
}

# Backup Configuration
variable "enable_backup_vault" {
  description = "Enable AWS Backup vault"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}