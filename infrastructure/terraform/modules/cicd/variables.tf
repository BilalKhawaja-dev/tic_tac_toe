# CI/CD Pipeline Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "services" {
  description = "List of services to create pipelines for"
  type        = list(string)
  default     = ["game-engine", "auth-service", "leaderboard-service", "frontend"]
}

variable "repository_name" {
  description = "Name of the CodeCommit repository"
  type        = string
}

variable "repository_arn" {
  description = "ARN of the CodeCommit repository"
  type        = string
}

variable "branch_name" {
  description = "Branch name to trigger pipeline"
  type        = string
  default     = "main"
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "enable_approval_stage" {
  description = "Enable manual approval stage for production deployments"
  type        = bool
  default     = false
}

variable "notification_emails" {
  description = "List of email addresses for pipeline notifications"
  type        = list(string)
  default     = []
}
