# ECS Module Variables

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

# Network Configuration
variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for ALB"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID for the Application Load Balancer"
  type        = string
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

# Security Configuration
variable "kms_key_arn" {
  description = "ARN of the KMS key for encryption"
  type        = string
}

variable "ssl_certificate_arn" {
  description = "ARN of the SSL certificate for HTTPS listener"
  type        = string
  default     = ""
}

# IAM Roles
variable "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  type        = string
}

variable "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  type        = string
}

# Database Configuration
variable "database_endpoint" {
  description = "Aurora database endpoint"
  type        = string
}

variable "database_name" {
  description = "Aurora database name"
  type        = string
}

variable "database_secret_arn" {
  description = "ARN of the database credentials secret"
  type        = string
}

variable "cognito_secret_arn" {
  description = "ARN of the Cognito credentials secret"
  type        = string
  default     = ""
}

# DynamoDB Configuration
variable "dynamodb_games_table" {
  description = "Name of the DynamoDB games table"
  type        = string
}

variable "dynamodb_moves_table" {
  description = "Name of the DynamoDB moves table"
  type        = string
}

variable "dynamodb_leaderboard_table" {
  description = "Name of the DynamoDB leaderboard table"
  type        = string
}

variable "dynamodb_sessions_table" {
  description = "Name of the DynamoDB sessions table"
  type        = string
}

variable "dax_endpoint" {
  description = "DAX cluster endpoint"
  type        = string
}

# Cache Configuration
variable "redis_endpoint" {
  description = "Redis cluster endpoint"
  type        = string
}

variable "redis_secret_arn" {
  description = "ARN of the Redis credentials secret"
  type        = string
}

# JWT Configuration
variable "jwt_secret_arn" {
  description = "ARN of the JWT secret"
  type        = string
}

# ECS Cluster Configuration
variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights for the ECS cluster"
  type        = bool
  default     = true
}

variable "enable_ecs_exec" {
  description = "Enable ECS Exec for debugging"
  type        = bool
  default     = false
}

# Capacity Provider Configuration
variable "fargate_base_capacity" {
  description = "Base capacity for Fargate capacity provider"
  type        = number
  default     = 1
}

variable "fargate_weight" {
  description = "Weight for Fargate capacity provider"
  type        = number
  default     = 100
}

variable "enable_fargate_spot" {
  description = "Enable Fargate Spot capacity provider"
  type        = bool
  default     = false
}

variable "fargate_spot_base_capacity" {
  description = "Base capacity for Fargate Spot capacity provider"
  type        = number
  default     = 0
}

variable "fargate_spot_weight" {
  description = "Weight for Fargate Spot capacity provider"
  type        = number
  default     = 0
}

# Game Engine Service Configuration
variable "game_engine_cpu" {
  description = "CPU units for the game engine task (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "game_engine_memory" {
  description = "Memory for the game engine task in MiB"
  type        = number
  default     = 1024
}

variable "game_engine_desired_count" {
  description = "Desired number of game engine tasks"
  type        = number
  default     = 2
}

variable "game_engine_min_capacity" {
  description = "Minimum number of game engine tasks"
  type        = number
  default     = 1
}

variable "game_engine_max_capacity" {
  description = "Maximum number of game engine tasks"
  type        = number
  default     = 10
}

variable "game_engine_image_tag" {
  description = "Docker image tag for the game engine"
  type        = string
  default     = "latest"
}

variable "game_engine_log_group" {
  description = "CloudWatch log group for game engine service"
  type        = string
}

# Auto Scaling Configuration
variable "cpu_target_value" {
  description = "Target CPU utilization percentage for auto scaling"
  type        = number
  default     = 70
}

variable "memory_target_value" {
  description = "Target memory utilization percentage for auto scaling"
  type        = number
  default     = 80
}

variable "scale_in_cooldown" {
  description = "Cooldown period for scale in actions (seconds)"
  type        = number
  default     = 300
}

variable "scale_out_cooldown" {
  description = "Cooldown period for scale out actions (seconds)"
  type        = number
  default     = 300
}

variable "enable_connection_based_scaling" {
  description = "Enable auto scaling based on WebSocket connections"
  type        = bool
  default     = true
}

variable "connections_target_value" {
  description = "Target number of connections per task for auto scaling"
  type        = number
  default     = 100
}

# Load Balancer Configuration
variable "enable_alb_access_logs" {
  description = "Enable ALB access logs"
  type        = bool
  default     = true
}

variable "alb_access_logs_bucket" {
  description = "S3 bucket for ALB access logs"
  type        = string
  default     = ""
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "warning_sns_topic_arn" {
  description = "SNS topic ARN for warning alerts"
  type        = string
}

variable "info_sns_topic_arn" {
  description = "SNS topic ARN for info alerts"
  type        = string
}


# Auth Service Configuration
variable "auth_service_cpu" {
  description = "CPU units for auth service"
  type        = number
  default     = 256
}

variable "auth_service_memory" {
  description = "Memory for auth service in MB"
  type        = number
  default     = 512
}

variable "auth_service_desired_count" {
  description = "Desired number of auth service tasks"
  type        = number
  default     = 2
}

variable "auth_service_image_tag" {
  description = "Docker image tag for auth service"
  type        = string
  default     = "latest"
}

variable "auth_service_log_group" {
  description = "CloudWatch log group for auth service"
  type        = string
  default     = "/ecs/auth-service"
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
  default     = ""
}

variable "cognito_client_id" {
  description = "Cognito Client ID"
  type        = string
  default     = ""
}

# Leaderboard Service Configuration
variable "leaderboard_service_cpu" {
  description = "CPU units for leaderboard service"
  type        = number
  default     = 256
}

variable "leaderboard_service_memory" {
  description = "Memory for leaderboard service in MB"
  type        = number
  default     = 512
}

variable "leaderboard_service_desired_count" {
  description = "Desired number of leaderboard service tasks"
  type        = number
  default     = 2
}

variable "leaderboard_service_image_tag" {
  description = "Docker image tag for leaderboard service"
  type        = string
  default     = "latest"
}

variable "leaderboard_service_log_group" {
  description = "CloudWatch log group for leaderboard service"
  type        = string
  default     = "/ecs/leaderboard-service"
}

# Frontend Configuration
variable "frontend_cpu" {
  description = "CPU units for frontend"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Memory for frontend in MB"
  type        = number
  default     = 512
}

variable "frontend_desired_count" {
  description = "Desired number of frontend tasks"
  type        = number
  default     = 2
}

variable "frontend_image_tag" {
  description = "Docker image tag for frontend"
  type        = string
  default     = "latest"
}

variable "frontend_log_group" {
  description = "CloudWatch log group for frontend"
  type        = string
  default     = "/ecs/frontend"
}
