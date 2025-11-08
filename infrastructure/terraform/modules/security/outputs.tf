# Outputs for Security Infrastructure Module

# KMS Key Outputs
output "main_kms_key_id" {
  description = "ID of the main KMS key"
  value       = aws_kms_key.main.key_id
}

output "main_kms_key_arn" {
  description = "ARN of the main KMS key"
  value       = aws_kms_key.main.arn
}

output "main_kms_key_alias" {
  description = "Alias of the main KMS key"
  value       = aws_kms_alias.main.name
}

output "rds_kms_key_id" {
  description = "ID of the RDS KMS key"
  value       = aws_kms_key.rds.key_id
}

output "rds_kms_key_arn" {
  description = "ARN of the RDS KMS key"
  value       = aws_kms_key.rds.arn
}

output "rds_kms_key_alias" {
  description = "Alias of the RDS KMS key"
  value       = aws_kms_alias.rds.name
}

output "s3_kms_key_id" {
  description = "ID of the S3 KMS key"
  value       = aws_kms_key.s3.key_id
}

output "s3_kms_key_arn" {
  description = "ARN of the S3 KMS key"
  value       = aws_kms_key.s3.arn
}

output "s3_kms_key_alias" {
  description = "Alias of the S3 KMS key"
  value       = aws_kms_alias.s3.name
}

# IAM Role Outputs
output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_execution_role_name" {
  description = "Name of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.name
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

output "ecs_task_role_name" {
  description = "Name of the ECS task role"
  value       = aws_iam_role.ecs_task.name
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda.arn
}

output "lambda_execution_role_name" {
  description = "Name of the Lambda execution role"
  value       = aws_iam_role.lambda.name
}

# Secrets Manager Outputs
output "database_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.database.arn
}

output "database_secret_name" {
  description = "Name of the database credentials secret"
  value       = aws_secretsmanager_secret.database.name
}

output "redis_secret_arn" {
  description = "ARN of the Redis credentials secret"
  value       = aws_secretsmanager_secret.redis.arn
}

output "redis_secret_name" {
  description = "Name of the Redis credentials secret"
  value       = aws_secretsmanager_secret.redis.name
}

output "jwt_secret_arn" {
  description = "ARN of the JWT signing key secret"
  value       = aws_secretsmanager_secret.jwt.arn
}

output "jwt_secret_name" {
  description = "Name of the JWT signing key secret"
  value       = aws_secretsmanager_secret.jwt.name
}

output "oauth_secret_arn" {
  description = "ARN of the OAuth credentials secret"
  value       = aws_secretsmanager_secret.oauth.arn
}

output "oauth_secret_name" {
  description = "Name of the OAuth credentials secret"
  value       = aws_secretsmanager_secret.oauth.name
}

# CloudTrail Outputs
output "cloudtrail_arn" {
  description = "ARN of the CloudTrail"
  value       = aws_cloudtrail.main.arn
}

output "cloudtrail_name" {
  description = "Name of the CloudTrail"
  value       = aws_cloudtrail.main.name
}

output "cloudtrail_s3_bucket_name" {
  description = "Name of the CloudTrail S3 bucket"
  value       = aws_s3_bucket.cloudtrail.bucket
}

output "cloudtrail_s3_bucket_arn" {
  description = "ARN of the CloudTrail S3 bucket"
  value       = aws_s3_bucket.cloudtrail.arn
}

output "cloudtrail_log_group_name" {
  description = "Name of the CloudTrail CloudWatch log group"
  value       = aws_cloudwatch_log_group.cloudtrail.name
}

output "cloudtrail_log_group_arn" {
  description = "ARN of the CloudTrail CloudWatch log group"
  value       = aws_cloudwatch_log_group.cloudtrail.arn
}

# Security Summary
output "security_summary" {
  description = "Summary of security configuration"
  value = {
    kms_keys_created      = 3
    iam_roles_created     = 3
    secrets_created       = 4
    cloudtrail_enabled    = true
    encryption_at_rest    = true
    encryption_in_transit = true
    audit_logging         = true
  }
}

# Secret ARNs for easy reference
output "all_secret_arns" {
  description = "Map of all secret ARNs"
  value = {
    database = aws_secretsmanager_secret.database.arn
    redis    = aws_secretsmanager_secret.redis.arn
    jwt      = aws_secretsmanager_secret.jwt.arn
    oauth    = aws_secretsmanager_secret.oauth.arn
  }
}

# KMS Key ARNs for easy reference
output "all_kms_key_arns" {
  description = "Map of all KMS key ARNs"
  value = {
    main = aws_kms_key.main.arn
    rds  = aws_kms_key.rds.arn
    s3   = aws_kms_key.s3.arn
  }
}

# IAM Role ARNs for easy reference
output "all_iam_role_arns" {
  description = "Map of all IAM role ARNs"
  value = {
    ecs_task_execution = aws_iam_role.ecs_task_execution.arn
    ecs_task           = aws_iam_role.ecs_task.arn
    lambda_execution   = aws_iam_role.lambda.arn
    cloudtrail_logs    = aws_iam_role.cloudtrail_logs.arn
  }
}