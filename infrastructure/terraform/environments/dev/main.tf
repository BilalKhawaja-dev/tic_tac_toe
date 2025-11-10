# Development Environment Configuration - Phase 1
# This configuration deploys core infrastructure without API Gateway and CI/CD

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Network Module
module "network" {
  source = "../../modules/network"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr
  tags         = var.common_tags
}

# Security Module  
module "security" {
  source = "../../modules/security"

  project_name      = var.project_name
  environment       = var.environment
  database_password = var.database_password
  redis_auth_token  = var.redis_auth_token
  jwt_signing_key   = var.jwt_signing_key
  
  # Disable problematic features for dev
  enable_guardduty                = false  # Already exists in account
  enable_security_hub             = false  # ARN format issues
  enable_cloudtrail_insights      = false  # Not supported in region
  enable_cloudtrail_data_events   = false  # Not supported in region
  
  tags = var.common_tags
}

# Monitoring Module (needed by database)
module "monitoring" {
  source = "../../modules/monitoring"

  project_name = var.project_name
  environment  = var.environment
  kms_key_arn  = module.security.kms_key_arn
  tags         = var.common_tags
}

# Database Module
module "database" {
  source = "../../modules/database"

  project_name                  = var.project_name
  environment                   = var.environment
  isolated_subnet_ids           = module.network.isolated_subnet_ids
  private_subnet_ids            = module.network.private_subnet_ids
  rds_security_group_id         = module.network.database_security_group_id
  lambda_security_group_id      = module.network.lambda_security_group_id
  elasticache_security_group_id = module.network.cache_security_group_id
  dax_security_group_id         = module.network.dax_security_group_id
  rds_kms_key_arn               = module.security.kms_key_arn
  database_secret_arn           = module.security.database_secret_arn
  master_password               = var.database_password
  redis_auth_token              = var.redis_auth_token
  critical_sns_topic_arn        = module.monitoring.critical_sns_topic_arn
  warning_sns_topic_arn         = module.monitoring.warning_sns_topic_arn
  info_sns_topic_arn            = module.monitoring.info_sns_topic_arn
  enable_global_tables          = false  # Disabled for dev - requires multi-region setup
  tags                          = var.common_tags
}

# Auth Module - PHASE 2
# Commented out due to circular dependency in Lambda triggers
# Will be deployed after fixing the auth module
# module "auth" {
#   source = "../../modules/auth"
#
#   project_name                    = var.project_name
#   environment                     = var.environment
#   kms_key_arn                     = module.security.kms_key_arn
#   database_secret_arn             = module.security.database_secret_arn
#   dynamodb_games_table_arn        = module.database.dynamodb_games_table_arn
#   dynamodb_sessions_table_arn     = module.database.dynamodb_sessions_table_arn
#   dynamodb_moves_table_arn        = module.database.dynamodb_moves_table_arn
#   dynamodb_leaderboard_table_arn  = module.database.dynamodb_leaderboard_table_arn
#   user_content_bucket_arn         = module.security.user_content_bucket_arn
#   enable_lambda_triggers          = false
#   tags                            = var.common_tags
# }

# ECS Module
module "ecs" {
  source = "../../modules/ecs"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  public_subnet_ids     = module.network.public_subnet_ids
  ecs_security_group_id = module.network.ecs_security_group_id
  alb_security_group_id = module.network.alb_security_group_id

  # Database configuration
  database_endpoint   = module.database.aurora_cluster_endpoint
  database_name       = module.database.database_name
  database_secret_arn = module.security.database_secret_arn

  # DynamoDB tables
  dynamodb_games_table       = module.database.dynamodb_games_table_name
  dynamodb_sessions_table    = module.database.dynamodb_sessions_table_name
  dynamodb_moves_table       = module.database.dynamodb_moves_table_name
  dynamodb_leaderboard_table = module.database.dynamodb_leaderboard_table_name

  # Cache configuration
  redis_endpoint   = module.database.redis_endpoint
  redis_secret_arn = module.security.redis_secret_arn
  dax_endpoint     = module.database.dax_endpoint

  # Security
  kms_key_arn    = module.security.kms_key_arn
  jwt_secret_arn = module.security.jwt_secret_arn

  # IAM roles
  ecs_task_execution_role_arn = module.security.ecs_task_execution_role_arn
  ecs_task_role_arn           = module.security.ecs_task_role_arn

  # Monitoring
  game_engine_log_group = module.monitoring.game_engine_log_group
  info_sns_topic_arn    = module.monitoring.info_sns_topic_arn
  warning_sns_topic_arn = module.monitoring.warning_sns_topic_arn

  tags = var.common_tags
}

# AppConfig Module
module "appconfig" {
  source = "../../modules/appconfig"

  application_name = var.project_name
  tags             = var.common_tags
}

# ============================================================================
# PHASE 2 MODULES - Uncomment after Phase 1 deployment completes
# ============================================================================

# # API Gateway Module
# module "api_gateway" {
#   source = "../../modules/api-gateway"
#
#   project_name          = var.project_name
#   environment           = var.environment
#   vpc_id                = module.network.vpc_id
#   private_subnet_ids    = module.network.private_subnet_ids
#   # cognito_user_pool_arn = module.auth.user_pool_arn  # Add after auth module deployed
#   # Add service URLs after ECS deployment
#   tags                  = var.common_tags
# }

# # CI/CD Module
# module "cicd" {
#   source = "../../modules/cicd"
#
#   project_name       = var.project_name
#   environment        = var.environment
#   github_repo        = var.github_repo
#   github_branch      = var.github_branch
#   ecr_repository_url = module.ecs.ecr_repository_url
#   ecs_cluster_name   = module.ecs.cluster_name
#   common_tags        = var.common_tags
# }
