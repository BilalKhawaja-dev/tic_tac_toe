# Outputs for Database Infrastructure Module

# Aurora Global Cluster
output "global_cluster_id" {
  description = "ID of the Aurora Global Cluster"
  value       = aws_rds_global_cluster.main.id
}

output "global_cluster_arn" {
  description = "ARN of the Aurora Global Cluster"
  value       = aws_rds_global_cluster.main.arn
}

output "global_cluster_engine" {
  description = "Engine of the Aurora Global Cluster"
  value       = aws_rds_global_cluster.main.engine
}

output "global_cluster_engine_version" {
  description = "Engine version of the Aurora Global Cluster"
  value       = aws_rds_global_cluster.main.engine_version
}

# Primary Aurora Cluster
output "primary_cluster_id" {
  description = "ID of the primary Aurora cluster"
  value       = aws_rds_cluster.primary_with_params.cluster_identifier
}

output "primary_cluster_arn" {
  description = "ARN of the primary Aurora cluster"
  value       = aws_rds_cluster.primary_with_params.arn
}

output "primary_cluster_endpoint" {
  description = "Writer endpoint of the primary Aurora cluster"
  value       = aws_rds_cluster.primary_with_params.endpoint
}

output "primary_cluster_reader_endpoint" {
  description = "Reader endpoint of the primary Aurora cluster"
  value       = aws_rds_cluster.primary_with_params.reader_endpoint
}

output "primary_cluster_port" {
  description = "Port of the primary Aurora cluster"
  value       = aws_rds_cluster.primary_with_params.port
}

output "primary_cluster_database_name" {
  description = "Database name of the primary Aurora cluster"
  value       = aws_rds_cluster.primary_with_params.database_name
}

output "primary_cluster_master_username" {
  description = "Master username of the primary Aurora cluster"
  value       = aws_rds_cluster.primary_with_params.master_username
  sensitive   = true
}

# Primary Aurora Cluster Instances
output "primary_instance_ids" {
  description = "IDs of the primary Aurora cluster instances"
  value       = aws_rds_cluster_instance.primary_with_params[*].id
}

output "primary_instance_endpoints" {
  description = "Endpoints of the primary Aurora cluster instances"
  value       = aws_rds_cluster_instance.primary_with_params[*].endpoint
}

output "primary_instance_arns" {
  description = "ARNs of the primary Aurora cluster instances"
  value       = aws_rds_cluster_instance.primary_with_params[*].arn
}

# Parameter Groups
output "cluster_parameter_group_name" {
  description = "Name of the Aurora cluster parameter group"
  value       = aws_rds_cluster_parameter_group.main.name
}

output "cluster_parameter_group_arn" {
  description = "ARN of the Aurora cluster parameter group"
  value       = aws_rds_cluster_parameter_group.main.arn
}

output "db_parameter_group_name" {
  description = "Name of the Aurora DB parameter group"
  value       = aws_db_parameter_group.main.name
}

output "db_parameter_group_arn" {
  description = "ARN of the Aurora DB parameter group"
  value       = aws_db_parameter_group.main.arn
}

# Subnet Group
output "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  value       = aws_db_subnet_group.aurora.name
}

output "db_subnet_group_arn" {
  description = "ARN of the DB subnet group"
  value       = aws_db_subnet_group.aurora.arn
}

# Schema Creator Lambda
output "schema_creator_function_name" {
  description = "Name of the schema creator Lambda function"
  value       = aws_lambda_function.schema_creator.function_name
}

output "schema_creator_function_arn" {
  description = "ARN of the schema creator Lambda function"
  value       = aws_lambda_function.schema_creator.arn
}

# CloudWatch Alarms
output "cloudwatch_alarm_names" {
  description = "Names of CloudWatch alarms for Aurora"
  value = {
    cpu_high         = aws_cloudwatch_metric_alarm.aurora_cpu_high.alarm_name
    connections_high = aws_cloudwatch_metric_alarm.aurora_connections_high.alarm_name
    read_latency     = aws_cloudwatch_metric_alarm.aurora_read_latency_high.alarm_name
    write_latency    = aws_cloudwatch_metric_alarm.aurora_write_latency_high.alarm_name
  }
}

output "cloudwatch_alarm_arns" {
  description = "ARNs of CloudWatch alarms for Aurora"
  value = {
    cpu_high         = aws_cloudwatch_metric_alarm.aurora_cpu_high.arn
    connections_high = aws_cloudwatch_metric_alarm.aurora_connections_high.arn
    read_latency     = aws_cloudwatch_metric_alarm.aurora_read_latency_high.arn
    write_latency    = aws_cloudwatch_metric_alarm.aurora_write_latency_high.arn
  }
}

# Connection Information
output "connection_info" {
  description = "Database connection information"
  value = {
    host     = aws_rds_cluster.primary_with_params.endpoint
    port     = aws_rds_cluster.primary_with_params.port
    database = aws_rds_cluster.primary_with_params.database_name
    username = aws_rds_cluster.primary_with_params.master_username
  }
  sensitive = true
}

# Database Summary
output "database_summary" {
  description = "Summary of database configuration"
  value = {
    global_cluster_created  = true
    primary_cluster_created = true
    primary_instances       = var.primary_instance_count
    engine                  = aws_rds_global_cluster.main.engine
    engine_version          = aws_rds_global_cluster.main.engine_version
    backup_retention_days   = var.backup_retention_period
    enhanced_monitoring     = var.enable_enhanced_monitoring
    performance_insights    = var.enable_performance_insights
    encryption_enabled      = true
    multi_az                = true
    schema_created          = true
  }
}

# DynamoDB Tables
output "dynamodb_table_names" {
  description = "Names of DynamoDB tables"
  value = {
    games         = aws_dynamodb_table.games.name
    game_moves    = aws_dynamodb_table.game_moves.name
    leaderboard   = aws_dynamodb_table.leaderboard.name
    user_sessions = aws_dynamodb_table.user_sessions.name
  }
}

output "dynamodb_table_arns" {
  description = "ARNs of DynamoDB tables"
  value = {
    games         = aws_dynamodb_table.games.arn
    game_moves    = aws_dynamodb_table.game_moves.arn
    leaderboard   = aws_dynamodb_table.leaderboard.arn
    user_sessions = aws_dynamodb_table.user_sessions.arn
  }
}

output "dynamodb_stream_arns" {
  description = "ARNs of DynamoDB streams"
  value = {
    games = aws_dynamodb_table.games.stream_arn
  }
}

output "dynamodb_global_table_names" {
  description = "Names of DynamoDB Global Tables"
  value = var.enable_global_tables ? {
    games         = aws_dynamodb_global_table.games_global[0].name
    game_moves    = aws_dynamodb_global_table.game_moves_global[0].name
    leaderboard   = aws_dynamodb_global_table.leaderboard_global[0].name
    user_sessions = aws_dynamodb_global_table.user_sessions_global[0].name
  } : {}
}

# Integration Points
output "integration_points" {
  description = "Key integration points for other modules"
  value = {
    # Aurora
    primary_endpoint = aws_rds_cluster.primary_with_params.endpoint
    reader_endpoint  = aws_rds_cluster.primary_with_params.reader_endpoint
    port             = aws_rds_cluster.primary_with_params.port
    database_name    = aws_rds_cluster.primary_with_params.database_name
    secret_arn       = var.database_secret_arn
    kms_key_arn      = var.rds_kms_key_arn

    # DynamoDB
    dynamodb_tables = {
      games         = aws_dynamodb_table.games.name
      game_moves    = aws_dynamodb_table.game_moves.name
      leaderboard   = aws_dynamodb_table.leaderboard.name
      user_sessions = aws_dynamodb_table.user_sessions.name
    }
    games_stream_arn = aws_dynamodb_table.games.stream_arn

    # ElastiCache
    redis_endpoint = aws_elasticache_replication_group.redis.primary_endpoint_address
    redis_port     = aws_elasticache_replication_group.redis.port

    # DAX
    dax_endpoint = aws_dax_cluster.main.cluster_address
    dax_port     = aws_dax_cluster.main.port
  }
}

# ElastiCache Outputs
output "redis_replication_group_id" {
  description = "ID of the Redis replication group"
  value       = aws_elasticache_replication_group.redis.replication_group_id
}

output "redis_primary_endpoint" {
  description = "Primary endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Reader endpoint of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "Port of the Redis cluster"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_auth_token_enabled" {
  description = "Whether Redis auth token is enabled"
  value       = aws_elasticache_replication_group.redis.auth_token != null
}

# DAX Outputs
output "dax_cluster_name" {
  description = "Name of the DAX cluster"
  value       = aws_dax_cluster.main.cluster_name
}

output "dax_cluster_arn" {
  description = "ARN of the DAX cluster"
  value       = aws_dax_cluster.main.arn
}

output "dax_cluster_address" {
  description = "DNS name of the DAX cluster"
  value       = aws_dax_cluster.main.cluster_address
}

output "dax_port" {
  description = "Port number of the DAX cluster"
  value       = aws_dax_cluster.main.port
}

output "dax_nodes" {
  description = "List of DAX cluster nodes"
  value       = aws_dax_cluster.main.nodes
}

# Caching Summary
output "caching_summary" {
  description = "Summary of caching configuration"
  value = {
    redis_cluster_created = true
    redis_nodes           = var.redis_num_cache_nodes
    redis_multi_az        = var.redis_multi_az_enabled
    redis_encryption      = true
    dax_cluster_created   = true
    dax_nodes             = var.dax_replication_factor
    dax_encryption        = true
  }
}