# Secrets Manager Automatic Rotation Configuration
# Implements automatic rotation for database credentials, API keys, and JWT secrets

# Lambda Function for Database Secret Rotation
resource "aws_lambda_function" "rotate_database_secret" {
  filename      = "${path.module}/lambda/rotate_secret.zip"
  function_name = "${var.project_name}-rotate-database-secret"
  role          = aws_iam_role.secret_rotation_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  environment {
    variables = {
      SECRET_ARN = aws_secretsmanager_secret.database.arn
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = var.tags
}

# Lambda Function for Redis Secret Rotation
resource "aws_lambda_function" "rotate_redis_secret" {
  filename      = "${path.module}/lambda/rotate_secret.zip"
  function_name = "${var.project_name}-rotate-redis-secret"
  role          = aws_iam_role.secret_rotation_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  environment {
    variables = {
      SECRET_ARN = aws_secretsmanager_secret.redis.arn
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = var.tags
}

# Lambda Function for JWT Secret Rotation
resource "aws_lambda_function" "rotate_jwt_secret" {
  filename      = "${path.module}/lambda/rotate_secret.zip"
  function_name = "${var.project_name}-rotate-jwt-secret"
  role          = aws_iam_role.secret_rotation_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  environment {
    variables = {
      SECRET_ARN = aws_secretsmanager_secret.jwt.arn
    }
  }

  tags = var.tags
}

# IAM Role for Secret Rotation Lambda
resource "aws_iam_role" "secret_rotation_lambda" {
  name = "${var.project_name}-secret-rotation-lambda-role"

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

# IAM Policy for Secret Rotation Lambda
resource "aws_iam_role_policy" "secret_rotation_lambda" {
  name = "${var.project_name}-secret-rotation-lambda-policy"
  role = aws_iam_role.secret_rotation_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage"
        ]
        Resource = [
          aws_secretsmanager_secret.database.arn,
          aws_secretsmanager_secret.redis.arn,
          aws_secretsmanager_secret.jwt.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetRandomPassword"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:ModifyDBInstance"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "elasticache:DescribeReplicationGroups",
          "elasticache:ModifyReplicationGroup"
        ]
        Resource = "*"
      },
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
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.main.arn
      }
    ]
  })
}

# Lambda Permission for Secrets Manager to invoke rotation function
resource "aws_lambda_permission" "allow_secrets_manager_database" {
  statement_id  = "AllowExecutionFromSecretsManager"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rotate_database_secret.function_name
  principal     = "secretsmanager.amazonaws.com"
}

resource "aws_lambda_permission" "allow_secrets_manager_redis" {
  statement_id  = "AllowExecutionFromSecretsManager"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rotate_redis_secret.function_name
  principal     = "secretsmanager.amazonaws.com"
}

resource "aws_lambda_permission" "allow_secrets_manager_jwt" {
  statement_id  = "AllowExecutionFromSecretsManager"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rotate_jwt_secret.function_name
  principal     = "secretsmanager.amazonaws.com"
}

# Secrets Manager Rotation Configuration
resource "aws_secretsmanager_secret_rotation" "database" {
  secret_id           = aws_secretsmanager_secret.database.id
  rotation_lambda_arn = aws_lambda_function.rotate_database_secret.arn

  rotation_rules {
    automatically_after_days = var.database_secret_rotation_days
  }
}

resource "aws_secretsmanager_secret_rotation" "redis" {
  secret_id           = aws_secretsmanager_secret.redis.id
  rotation_lambda_arn = aws_lambda_function.rotate_redis_secret.arn

  rotation_rules {
    automatically_after_days = var.redis_secret_rotation_days
  }
}

resource "aws_secretsmanager_secret_rotation" "jwt" {
  secret_id           = aws_secretsmanager_secret.jwt.id
  rotation_lambda_arn = aws_lambda_function.rotate_jwt_secret.arn

  rotation_rules {
    automatically_after_days = var.jwt_secret_rotation_days
  }
}

# CloudWatch Alarms for Secret Rotation Failures
resource "aws_cloudwatch_metric_alarm" "secret_rotation_failure" {
  alarm_name          = "${var.project_name}-secret-rotation-failure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Alert when secret rotation fails"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.rotate_database_secret.function_name
  }

  alarm_actions = [var.critical_sns_topic_arn]

  tags = var.tags
}

# CloudWatch Log Groups for Rotation Lambdas
resource "aws_cloudwatch_log_group" "rotate_database_secret" {
  name              = "/aws/lambda/${aws_lambda_function.rotate_database_secret.function_name}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.main.arn

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "rotate_redis_secret" {
  name              = "/aws/lambda/${aws_lambda_function.rotate_redis_secret.function_name}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.main.arn

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "rotate_jwt_secret" {
  name              = "/aws/lambda/${aws_lambda_function.rotate_jwt_secret.function_name}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.main.arn

  tags = var.tags
}
