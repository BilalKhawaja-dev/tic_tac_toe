# Variables for Database Infrastructure Module

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
    Component = "database"
  }
}

# Network Configuration
variable "isolated_subnet_ids" {
  description = "List of isolated subnet IDs for database"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Lambda"
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "Security group ID for RDS"
  type        = string
}

variable "lambda_security_group_id" {
  description = "Security group ID for Lambda"
  type        = string
}

# Security Configuration
variable "rds_kms_key_arn" {
  description = "ARN of the KMS key for RDS encryption"
  type        = string
}

variable "database_secret_arn" {
  description = "ARN of the database credentials secret"
  type        = string
}

# SNS Topics for Alerts
variable "critical_sns_topic_arn" {
  description = "ARN of the critical alerts SNS topic"
  type        = string
}

variable "warning_sns_topic_arn" {
  description = "ARN of the warning alerts SNS topic"
  type        = string
}

variable "info_sns_topic_arn" {
  description = "ARN of the info alerts SNS topic"
  type        = string
}

# Aurora Configuration
variable "aurora_engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "gamedb"
}

variable "master_username" {
  description = "Master username for the database"
  type        = string
  default     = "gameadmin"
  sensitive   = true
}

variable "master_password" {
  description = "Master password for the database"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.master_password) >= 12
    error_message = "Master password must be at least 12 characters long."
  }
}

variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_period >= 1 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "primary_instance_count" {
  description = "Number of instances in the primary cluster"
  type        = number
  default     = 2

  validation {
    condition     = var.primary_instance_count >= 1 && var.primary_instance_count <= 15
    error_message = "Primary instance count must be between 1 and 15."
  }
}

variable "primary_instance_class" {
  description = "Instance class for primary cluster"
  type        = string
  default     = "db.r6g.large"
}

variable "max_connections" {
  description = "Maximum number of database connections"
  type        = string
  default     = "200"
}

variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

# Monitoring Configuration
variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring for RDS"
  type        = bool
  default     = true
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights for RDS"
  type        = bool
  default     = true
}

variable "performance_insights_retention" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7

  validation {
    condition     = contains([7, 31, 62, 93, 124, 155, 186, 217, 248, 279, 310, 341, 372, 403, 434, 465, 496, 527, 558, 589, 620, 651, 682, 713, 731], var.performance_insights_retention)
    error_message = "Performance Insights retention must be a valid value."
  }
}

# Read Replica Configuration
variable "enable_read_replica" {
  description = "Enable read replica in secondary region"
  type        = bool
  default     = true
}

variable "read_replica_region" {
  description = "Region for read replica"
  type        = string
  default     = "eu-west-1"
}

variable "read_replica_instance_count" {
  description = "Number of instances in the read replica cluster"
  type        = number
  default     = 1

  validation {
    condition     = var.read_replica_instance_count >= 1 && var.read_replica_instance_count <= 15
    error_message = "Read replica instance count must be between 1 and 15."
  }
}

variable "read_replica_instance_class" {
  description = "Instance class for read replica cluster"
  type        = string
  default     = "db.r6g.large"
}

# Scaling Configuration
variable "enable_autoscaling" {
  description = "Enable Aurora Serverless v2 autoscaling"
  type        = bool
  default     = false
}

variable "min_capacity" {
  description = "Minimum Aurora Serverless v2 capacity"
  type        = number
  default     = 0.5
}

variable "max_capacity" {
  description = "Maximum Aurora Serverless v2 capacity"
  type        = number
  default     = 16
}

# Backup Configuration
variable "enable_cross_region_backup" {
  description = "Enable cross-region backup replication"
  type        = bool
  default     = false
}

variable "cross_region_backup_retention" {
  description = "Cross-region backup retention period in days"
  type        = number
  default     = 30
}

# DynamoDB Configuration
variable "dynamodb_kms_key_arn" {
  description = "ARN of the KMS key for DynamoDB encryption"
  type        = string
  default     = ""
}

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode (PROVISIONED or PAY_PER_REQUEST)"
  type        = string
  default     = "PAY_PER_REQUEST"

  validation {
    condition     = contains(["PROVISIONED", "PAY_PER_REQUEST"], var.dynamodb_billing_mode)
    error_message = "DynamoDB billing mode must be either PROVISIONED or PAY_PER_REQUEST."
  }
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB tables"
  type        = bool
  default     = true
}

variable "enable_global_tables" {
  description = "Enable DynamoDB Global Tables for multi-region replication"
  type        = bool
  default     = true
}

variable "secondary_region" {
  description = "Secondary region for Global Tables"
  type        = string
  default     = "eu-west-1"
}

variable "enable_autoscaling" {
  description = "Enable auto scaling for DynamoDB tables (only for PROVISIONED billing)"
  type        = bool
  default     = true
}

# Games table capacity settings
variable "games_table_read_capacity" {
  description = "Read capacity units for games table"
  type        = number
  default     = 5
}

variable "games_table_write_capacity" {
  description = "Write capacity units for games table"
  type        = number
  default     = 5
}

variable "games_table_max_read_capacity" {
  description = "Maximum read capacity units for games table auto scaling"
  type        = number
  default     = 100
}

variable "games_table_max_write_capacity" {
  description = "Maximum write capacity units for games table auto scaling"
  type        = number
  default     = 100
}

# Game moves table capacity settings
variable "moves_table_read_capacity" {
  description = "Read capacity units for game moves table"
  type        = number
  default     = 5
}

variable "moves_table_write_capacity" {
  description = "Write capacity units for game moves table"
  type        = number
  default     = 5
}

# Leaderboard table capacity settings
variable "leaderboard_table_read_capacity" {
  description = "Read capacity units for leaderboard table"
  type        = number
  default     = 5
}

variable "leaderboard_table_write_capacity" {
  description = "Write capacity units for leaderboard table"
  type        = number
  default     = 5
}

# User sessions table capacity settings
variable "sessions_table_read_capacity" {
  description = "Read capacity units for user sessions table"
  type        = number
  default     = 5
}

variable "sessions_table_write_capacity" {
  description = "Write capacity units for user sessions table"
  type        = number
  default     = 5
}

# GSI capacity settings
variable "gsi_read_capacity" {
  description = "Read capacity units for Global Secondary Indexes"
  type        = number
  default     = 5
}

variable "gsi_write_capacity" {
  description = "Write capacity units for Global Secondary Indexes"
  type        = number
  default     = 5
}

# ElastiCache Configuration
variable "elasticache_security_group_id" {
  description = "Security group ID for ElastiCache"
  type        = string
}

variable "redis_kms_key_arn" {
  description = "ARN of the KMS key for Redis encryption"
  type        = string
  default     = ""
}

variable "redis_auth_token" {
  description = "Auth token for Redis"
  type        = string
  sensitive   = true
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.r7g.large"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the Redis cluster"
  type        = number
  default     = 3

  validation {
    condition     = var.redis_num_cache_nodes >= 1 && var.redis_num_cache_nodes <= 6
    error_message = "Redis cache nodes must be between 1 and 6."
  }
}

variable "redis_multi_az_enabled" {
  description = "Enable Multi-AZ for Redis"
  type        = bool
  default     = true
}

variable "redis_automatic_failover_enabled" {
  description = "Enable automatic failover for Redis"
  type        = bool
  default     = true
}

variable "redis_snapshot_retention_limit" {
  description = "Number of days to retain Redis snapshots"
  type        = number
  default     = 5

  validation {
    condition     = var.redis_snapshot_retention_limit >= 0 && var.redis_snapshot_retention_limit <= 35
    error_message = "Redis snapshot retention limit must be between 0 and 35 days."
  }
}

variable "redis_snapshot_window" {
  description = "Daily time range for Redis snapshots"
  type        = string
  default     = "03:00-05:00"
}

variable "redis_maintenance_window" {
  description = "Weekly time range for Redis maintenance"
  type        = string
  default     = "sun:05:00-sun:07:00"
}

variable "redis_log_retention_days" {
  description = "Number of days to retain Redis logs"
  type        = number
  default     = 7
}

# DAX Configuration
variable "dax_security_group_id" {
  description = "Security group ID for DAX"
  type        = string
}

variable "dax_node_type" {
  description = "DAX node type"
  type        = string
  default     = "dax.r4.large"
}

variable "dax_replication_factor" {
  description = "Number of nodes in the DAX cluster"
  type        = number
  default     = 3

  validation {
    condition     = var.dax_replication_factor >= 1 && var.dax_replication_factor <= 10
    error_message = "DAX replication factor must be between 1 and 10."
  }
}

variable "dax_maintenance_window" {
  description = "Weekly time range for DAX maintenance"
  type        = string
  default     = "sun:05:00-sun:06:00"
}