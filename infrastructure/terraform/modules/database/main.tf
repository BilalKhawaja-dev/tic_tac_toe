# Database Infrastructure Module
# Creates Aurora Global Database, DynamoDB tables, ElastiCache, and DAX

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Aurora Subnet Group (using isolated subnets from network module)
resource "aws_db_subnet_group" "aurora" {
  name       = "${var.project_name}-aurora-subnet-group"
  subnet_ids = var.isolated_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-aurora-subnet-group"
    Type = "database"
  })
}

# Aurora Global Database Cluster (disabled for dev - not all versions support global)
# Enable for production with supported engine version
# resource "aws_rds_global_cluster" "main" {
#   global_cluster_identifier = "${var.project_name}-global-cluster"
#   engine                    = "aurora-postgresql"
#   engine_version            = "15.3" # Use specific version that supports global
#   database_name             = var.database_name
#   storage_encrypted         = true
#   deletion_protection       = var.environment == "production"
# }

# Primary Aurora Cluster (eu-west-2)
resource "aws_rds_cluster" "primary" {
  cluster_identifier           = "${var.project_name}-aurora-cluster"
  # global_cluster_identifier disabled for dev
  engine                       = "aurora-postgresql"
  engine_version               = var.aurora_engine_version
  database_name                = var.database_name
  master_username              = var.master_username
  master_password              = var.master_password
  backup_retention_period      = var.backup_retention_period
  preferred_backup_window      = var.backup_window
  preferred_maintenance_window = var.maintenance_window
  storage_encrypted            = true
  kms_key_id                   = var.rds_kms_key_arn
  deletion_protection          = var.environment == "production"

  db_subnet_group_name            = aws_db_subnet_group.aurora.name
  vpc_security_group_ids          = [var.rds_security_group_id]
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name

  # Performance Insights
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # Backup configuration
  copy_tags_to_snapshot     = true
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-aurora-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null

  # Enhanced monitoring
  monitoring_interval = var.enable_enhanced_monitoring ? 60 : 0
  monitoring_role_arn = var.enable_enhanced_monitoring ? aws_iam_role.rds_enhanced_monitoring[0].arn : null

  # Performance Insights
  performance_insights_enabled          = var.enable_performance_insights
  performance_insights_kms_key_id       = var.enable_performance_insights ? var.rds_kms_key_arn : null
  performance_insights_retention_period = var.enable_performance_insights ? var.performance_insights_retention : null

  tags = merge(var.tags, {
    Name = "${var.project_name}-aurora-primary"
    Role = "primary"
  })
}

# Primary Aurora Cluster Instances
resource "aws_rds_cluster_instance" "primary" {
  count              = var.primary_instance_count
  identifier         = "${var.project_name}-aurora-cluster-${count.index}"
  cluster_identifier = aws_rds_cluster.primary.id
  instance_class     = var.primary_instance_class
  engine             = aws_rds_cluster.primary.engine
  engine_version     = aws_rds_cluster.primary.engine_version

  db_parameter_group_name = aws_db_parameter_group.main.name

  # Performance Insights
  performance_insights_enabled    = var.enable_performance_insights
  performance_insights_kms_key_id = var.enable_performance_insights ? var.rds_kms_key_arn : null

  # Monitoring
  monitoring_interval = var.enable_enhanced_monitoring ? 60 : 0
  monitoring_role_arn = var.enable_enhanced_monitoring ? aws_iam_role.rds_enhanced_monitoring[0].arn : null

  # Auto minor version upgrade
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  tags = merge(var.tags, {
    Name = "${var.project_name}-aurora-cluster-${count.index}"
    Role = "primary"
  })
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  count = var.enable_enhanced_monitoring ? 1 : 0
  name  = "${var.project_name}-rds-enhanced-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy Attachment for Enhanced Monitoring
resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  count      = var.enable_enhanced_monitoring ? 1 : 0
  role       = aws_iam_role.rds_enhanced_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Aurora Cluster Parameter Group
resource "aws_rds_cluster_parameter_group" "main" {
  family = "aurora-postgresql15"
  name   = "${var.project_name}-aurora-cluster-params"

  # Performance and connection parameters
  # shared_preload_libraries removed - requires reboot (static parameter)
  
  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking longer than 1 second
  }

  parameter {
    name         = "max_connections"
    value        = var.max_connections
    apply_method = "pending-reboot"
  }

  parameter {
    name  = "work_mem"
    value = "16384" # 16MB
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "262144" # 256MB
  }

  parameter {
    name         = "effective_cache_size"
    value        = "1048576" # 1GB
    apply_method = "pending-reboot"
  }

  tags = var.tags
}

# Aurora DB Parameter Group
resource "aws_db_parameter_group" "main" {
  family = "aurora-postgresql15"
  name   = "${var.project_name}-aurora-db-params"

  # Connection and performance parameters
  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  # log_checkpoints parameter not supported in Aurora PostgreSQL
  # Removed to fix deployment error

  tags = var.tags
}



# Database Schema Creation Lambda
resource "aws_lambda_function" "schema_creator" {
  filename         = data.archive_file.schema_creator.output_path
  function_name    = "${var.project_name}-schema-creator"
  role             = aws_iam_role.schema_creator_lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.schema_creator.output_base64sha256
  runtime          = "python3.9"
  timeout          = 300

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  environment {
    variables = {
      DB_HOST     = aws_rds_cluster.primary.endpoint
      DB_NAME     = var.database_name
      SECRET_ARN  = var.database_secret_arn
      KMS_KEY_ARN = var.rds_kms_key_arn
    }
  }

  tags = var.tags

  depends_on = [aws_rds_cluster_instance.primary]
}

# Archive file for schema creator Lambda
data "archive_file" "schema_creator" {
  type        = "zip"
  output_path = "schema_creator.zip"
  source {
    content = templatefile("${path.module}/lambda/schema_creator.py", {
      project_name = var.project_name
    })
    filename = "index.py"
  }
}

# IAM Role for Schema Creator Lambda
resource "aws_iam_role" "schema_creator_lambda" {
  name = "${var.project_name}-schema-creator-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for Schema Creator Lambda
resource "aws_iam_role_policy" "schema_creator_lambda" {
  name = "${var.project_name}-schema-creator-lambda-policy"
  role = aws_iam_role.schema_creator_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.database_secret_arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.rds_kms_key_arn
      }
    ]
  })
}

# Lambda invocation to create schema
# Commented out - requires psycopg2 layer to be packaged
# resource "aws_lambda_invocation" "schema_creation" {
#   function_name = aws_lambda_function.schema_creator.function_name
#
#   input = jsonencode({
#     action = "create_schema"
#   })
#
#   depends_on = [aws_rds_cluster_instance.primary]
# }

# CloudWatch Alarms for Aurora
resource "aws_cloudwatch_metric_alarm" "aurora_cpu_high" {
  alarm_name          = "${var.project_name}-aurora-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Aurora CPU utilization"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.primary.cluster_identifier
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_connections_high" {
  alarm_name          = "${var.project_name}-aurora-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.max_connections * 0.8 # 80% of max connections
  alarm_description   = "This metric monitors Aurora connection count"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.primary.cluster_identifier
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_read_latency_high" {
  alarm_name          = "${var.project_name}-aurora-read-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.2" # 200ms
  alarm_description   = "This metric monitors Aurora read latency"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.primary.cluster_identifier
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "aurora_write_latency_high" {
  alarm_name          = "${var.project_name}-aurora-write-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "WriteLatency"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.2" # 200ms
  alarm_description   = "This metric monitors Aurora write latency"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.primary.cluster_identifier
  }

  tags = var.tags
}