# Authentication Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
}

variable "tags" {
  description = "A map of tags to assign to the resources"
  type        = map(string)
  default     = {}
}

# Cognito Configuration
variable "enable_advanced_security" {
  description = "Enable advanced security features for Cognito User Pool"
  type        = bool
  default     = true
}

variable "allow_unauthenticated_identities" {
  description = "Allow unauthenticated identities in the identity pool"
  type        = bool
  default     = false
}

# OAuth Configuration
variable "callback_urls" {
  description = "List of allowed callback URLs for OAuth"
  type        = list(string)
  default     = ["http://localhost:3000/auth/callback"]
}

variable "logout_urls" {
  description = "List of allowed logout URLs for OAuth"
  type        = list(string)
  default     = ["http://localhost:3000/auth/logout"]
}

variable "mobile_callback_urls" {
  description = "List of allowed callback URLs for mobile OAuth"
  type        = list(string)
  default     = ["myapp://auth/callback"]
}

variable "mobile_logout_urls" {
  description = "List of allowed logout URLs for mobile OAuth"
  type        = list(string)
  default     = ["myapp://auth/logout"]
}

# Token Configuration
variable "access_token_validity_hours" {
  description = "Access token validity in hours"
  type        = number
  default     = 1
}

variable "id_token_validity_hours" {
  description = "ID token validity in hours"
  type        = number
  default     = 1
}

variable "refresh_token_validity_days" {
  description = "Refresh token validity in days"
  type        = number
  default     = 30
}

# Email Configuration
variable "ses_email_identity" {
  description = "SES email identity ARN for sending emails"
  type        = string
  default     = ""
}

variable "from_email_address" {
  description = "From email address for Cognito emails"
  type        = string
  default     = ""
}

# Social OAuth Providers
variable "enable_google_oauth" {
  description = "Enable Google OAuth integration"
  type        = bool
  default     = true
}

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

variable "enable_facebook_oauth" {
  description = "Enable Facebook OAuth integration"
  type        = bool
  default     = true
}

variable "facebook_app_id" {
  description = "Facebook App ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "facebook_app_secret" {
  description = "Facebook App Secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_twitter_oauth" {
  description = "Enable Twitter OAuth integration (via Amazon Login)"
  type        = bool
  default     = false
}

variable "amazon_client_id" {
  description = "Amazon Login client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "amazon_client_secret" {
  description = "Amazon Login client secret"
  type        = string
  default     = ""
  sensitive   = true
}

# Lambda Triggers
variable "enable_lambda_triggers" {
  description = "Enable Lambda triggers for Cognito events"
  type        = bool
  default     = true
}

# Database Integration
variable "database_secret_arn" {
  description = "ARN of the database credentials secret"
  type        = string
}

# DynamoDB Tables
variable "dynamodb_games_table_arn" {
  description = "ARN of the DynamoDB games table"
  type        = string
}

variable "dynamodb_moves_table_arn" {
  description = "ARN of the DynamoDB moves table"
  type        = string
}

variable "dynamodb_leaderboard_table_arn" {
  description = "ARN of the DynamoDB leaderboard table"
  type        = string
}

variable "dynamodb_sessions_table_arn" {
  description = "ARN of the DynamoDB sessions table"
  type        = string
}

# S3 Configuration
variable "user_content_bucket_arn" {
  description = "ARN of the S3 bucket for user content (avatars, etc.)"
  type        = string
}

# Security Configuration
variable "kms_key_arn" {
  description = "ARN of the KMS key for encryption"
  type        = string
}

# Logging Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}