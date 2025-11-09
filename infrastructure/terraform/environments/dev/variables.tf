# Development Environment Variables

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "global-gaming-platform"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_backup_retention_period" {
  description = "Database backup retention period in days"
  type        = number
  default     = 7
}

variable "ecs_task_cpu" {
  description = "ECS task CPU units"
  type        = string
  default     = "256"
}

variable "ecs_task_memory" {
  description = "ECS task memory in MB"
  type        = string
  default     = "512"
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = "alerts@example.com"
}

variable "service_names" {
  description = "List of service names"
  type        = list(string)
  default     = ["game-engine", "auth-service", "leaderboard-service", "support-service"]
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "your-org/tic-tac-toe"
}

variable "github_branch" {
  description = "GitHub branch for deployment"
  type        = string
  default     = "develop"
}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "global-gaming-platform"
    Environment = "dev"
    ManagedBy   = "Terraform"
  }
}

# Security Secrets
variable "database_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
  default     = "ChangeMe123456!" # Change in production!
}

variable "redis_auth_token" {
  description = "Redis authentication token"
  type        = string
  sensitive   = true
  default     = "ChangeMe1234567890!" # Change in production!
}

variable "jwt_signing_key" {
  description = "JWT signing key"
  type        = string
  sensitive   = true
  default     = "ChangeMe12345678901234567890123!" # Change in production!
}
