# User Authentication Infrastructure Module
# Creates AWS Cognito User Pool, Identity Pool, and OAuth configuration

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

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  # User attributes
  alias_attributes = ["email", "preferred_username"]

  username_attributes = ["email"]

  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = var.enable_advanced_security ? "ENFORCED" : "OFF"
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Admin create user config
  admin_create_user_config {
    allow_admin_create_user_only = false

    invite_message_template {
      email_message = "Welcome to ${var.project_name}! Your username is {username} and temporary password is {####}"
      email_subject = "Welcome to ${var.project_name}"
      sms_message   = "Your username is {username} and temporary password is {####}"
    }
  }

  # Device configuration
  device_configuration {
    challenge_required_on_new_device      = true
    device_only_remembered_on_user_prompt = true
  }

  # Email configuration
  email_configuration {
    email_sending_account = var.ses_email_identity != "" ? "DEVELOPER" : "COGNITO_DEFAULT"
    source_arn            = var.ses_email_identity != "" ? var.ses_email_identity : null
    from_email_address    = var.from_email_address
  }

  # Lambda triggers
  dynamic "lambda_config" {
    for_each = var.enable_lambda_triggers ? [1] : []
    content {
      pre_sign_up          = aws_lambda_function.pre_signup[0].arn
      post_confirmation    = aws_lambda_function.post_confirmation[0].arn
      pre_authentication   = aws_lambda_function.pre_authentication[0].arn
      post_authentication  = aws_lambda_function.post_authentication[0].arn
      pre_token_generation = aws_lambda_function.pre_token_generation[0].arn
      user_migration       = aws_lambda_function.user_migration[0].arn
    }
  }

  # Schema
  schema {
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    name                     = "email"
    required                 = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    name                     = "given_name"
    required                 = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    name                     = "family_name"
    required                 = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    name                     = "picture"
    required                 = false

    string_attribute_constraints {
      min_length = 1
      max_length = 2048
    }
  }

  # Custom attributes
  schema {
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    name                     = "player_id"
    required                 = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    attribute_data_type      = "Number"
    developer_only_attribute = false
    mutable                  = true
    name                     = "games_played"
    required                 = false

    number_attribute_constraints {
      min_value = 0
      max_value = 999999
    }
  }

  schema {
    attribute_data_type      = "Number"
    developer_only_attribute = false
    mutable                  = true
    name                     = "games_won"
    required                 = false

    number_attribute_constraints {
      min_value = 0
      max_value = 999999
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-user-pool"
    Type = "cognito-user-pool"
  })
}

# Cognito User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-auth-${random_string.domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "random_string" "domain_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Cognito User Pool Client (Web App)
resource "aws_cognito_user_pool_client" "web_client" {
  name         = "${var.project_name}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth settings
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile", "aws.cognito.signin.user.admin"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  # Supported identity providers
  supported_identity_providers = concat(
    ["COGNITO"],
    var.enable_google_oauth ? ["Google"] : [],
    var.enable_facebook_oauth ? ["Facebook"] : [],
    var.enable_twitter_oauth ? ["LoginWithAmazon"] : []
  )

  # Token validity
  access_token_validity  = var.access_token_validity_hours
  id_token_validity      = var.id_token_validity_hours
  refresh_token_validity = var.refresh_token_validity_days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Security settings
  generate_secret                               = false
  prevent_user_existence_errors                 = "ENABLED"
  enable_token_revocation                       = true
  enable_propagate_additional_user_context_data = false

  # Read and write attributes
  read_attributes = [
    "email",
    "email_verified",
    "given_name",
    "family_name",
    "picture",
    "custom:player_id",
    "custom:games_played",
    "custom:games_won"
  ]

  write_attributes = [
    "email",
    "given_name",
    "family_name",
    "picture",
    "custom:player_id"
  ]

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]
}

# Cognito User Pool Client (Mobile App)
resource "aws_cognito_user_pool_client" "mobile_client" {
  name         = "${var.project_name}-mobile-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth settings
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile", "aws.cognito.signin.user.admin"]

  callback_urls = var.mobile_callback_urls
  logout_urls   = var.mobile_logout_urls

  # Supported identity providers
  supported_identity_providers = concat(
    ["COGNITO"],
    var.enable_google_oauth ? ["Google"] : [],
    var.enable_facebook_oauth ? ["Facebook"] : []
  )

  # Token validity
  access_token_validity  = var.access_token_validity_hours
  id_token_validity      = var.id_token_validity_hours
  refresh_token_validity = var.refresh_token_validity_days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Security settings
  generate_secret               = true
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  # Read and write attributes
  read_attributes = [
    "email",
    "email_verified",
    "given_name",
    "family_name",
    "picture",
    "custom:player_id",
    "custom:games_played",
    "custom:games_won"
  ]

  write_attributes = [
    "email",
    "given_name",
    "family_name",
    "picture",
    "custom:player_id"
  ]

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

# Google Identity Provider
resource "aws_cognito_identity_provider" "google" {
  count         = var.enable_google_oauth ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "email openid profile"
  }

  attribute_mapping = {
    email       = "email"
    given_name  = "given_name"
    family_name = "family_name"
    picture     = "picture"
    username    = "sub"
  }
}

# Facebook Identity Provider
resource "aws_cognito_identity_provider" "facebook" {
  count         = var.enable_facebook_oauth ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Facebook"
  provider_type = "Facebook"

  provider_details = {
    client_id        = var.facebook_app_id
    client_secret    = var.facebook_app_secret
    authorize_scopes = "email public_profile"
  }

  attribute_mapping = {
    email       = "email"
    given_name  = "first_name"
    family_name = "last_name"
    picture     = "picture"
    username    = "id"
  }
}

# Amazon Identity Provider (for Twitter-like functionality)
resource "aws_cognito_identity_provider" "amazon" {
  count         = var.enable_twitter_oauth ? 1 : 0
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "LoginWithAmazon"
  provider_type = "LoginWithAmazon"

  provider_details = {
    client_id        = var.amazon_client_id
    client_secret    = var.amazon_client_secret
    authorize_scopes = "profile"
  }

  attribute_mapping = {
    email      = "email"
    given_name = "name"
    username   = "user_id"
  }
}

# Cognito Identity Pool
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}-identity-pool"
  allow_unauthenticated_identities = var.allow_unauthenticated_identities

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.web_client.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.mobile_client.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  # Social identity providers
  dynamic "supported_login_providers" {
    for_each = var.enable_google_oauth ? { google = "accounts.google.com" } : {}
    content {
      key   = supported_login_providers.key
      value = supported_login_providers.value
    }
  }

  dynamic "supported_login_providers" {
    for_each = var.enable_facebook_oauth ? { facebook = "graph.facebook.com" } : {}
    content {
      key   = supported_login_providers.key
      value = supported_login_providers.value
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-identity-pool"
    Type = "cognito-identity-pool"
  })
}

# IAM Role for authenticated users
resource "aws_iam_role" "authenticated" {
  name = "${var.project_name}-cognito-authenticated-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for authenticated users
resource "aws_iam_role_policy" "authenticated" {
  name = "${var.project_name}-cognito-authenticated-policy"
  role = aws_iam_role.authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-sync:*",
          "cognito-identity:*"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          var.dynamodb_games_table_arn,
          "${var.dynamodb_games_table_arn}/index/*",
          var.dynamodb_moves_table_arn,
          "${var.dynamodb_moves_table_arn}/index/*",
          var.dynamodb_leaderboard_table_arn,
          "${var.dynamodb_leaderboard_table_arn}/index/*",
          var.dynamodb_sessions_table_arn,
          "${var.dynamodb_sessions_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${var.user_content_bucket_arn}/*"
        ]
      }
    ]
  })
}

# IAM Role for unauthenticated users
resource "aws_iam_role" "unauthenticated" {
  count = var.allow_unauthenticated_identities ? 1 : 0
  name  = "${var.project_name}-cognito-unauthenticated-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "unauthenticated"
          }
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for unauthenticated users
resource "aws_iam_role_policy" "unauthenticated" {
  count = var.allow_unauthenticated_identities ? 1 : 0
  name  = "${var.project_name}-cognito-unauthenticated-policy"
  role  = aws_iam_role.unauthenticated[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-sync:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Cognito Identity Pool Role Attachment
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = merge(
    {
      "authenticated" = aws_iam_role.authenticated.arn
    },
    var.allow_unauthenticated_identities ? {
      "unauthenticated" = aws_iam_role.unauthenticated[0].arn
    } : {}
  )

  role_mapping {
    identity_provider         = aws_cognito_user_pool.main.endpoint
    ambiguous_role_resolution = "AuthenticatedRole"
    type                      = "Token"
  }
}

# Lambda functions for Cognito triggers
resource "aws_lambda_function" "pre_signup" {
  count            = var.enable_lambda_triggers ? 1 : 0
  filename         = "lambda/pre_signup.zip"
  function_name    = "${var.project_name}-cognito-pre-signup"
  role             = aws_iam_role.lambda_execution[0].arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.pre_signup_zip[0].output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30

  environment {
    variables = {
      USER_POOL_ID = aws_cognito_user_pool.main.id
    }
  }

  tags = var.tags
}

resource "aws_lambda_function" "post_confirmation" {
  count            = var.enable_lambda_triggers ? 1 : 0
  filename         = "lambda/post_confirmation.zip"
  function_name    = "${var.project_name}-cognito-post-confirmation"
  role             = aws_iam_role.lambda_execution[0].arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.post_confirmation_zip[0].output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30

  environment {
    variables = {
      USER_POOL_ID        = aws_cognito_user_pool.main.id
      DATABASE_SECRET_ARN = var.database_secret_arn
    }
  }

  tags = var.tags
}

resource "aws_lambda_function" "pre_authentication" {
  count            = var.enable_lambda_triggers ? 1 : 0
  filename         = "lambda/pre_authentication.zip"
  function_name    = "${var.project_name}-cognito-pre-authentication"
  role             = aws_iam_role.lambda_execution[0].arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.pre_authentication_zip[0].output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30

  tags = var.tags
}

resource "aws_lambda_function" "post_authentication" {
  count            = var.enable_lambda_triggers ? 1 : 0
  filename         = "lambda/post_authentication.zip"
  function_name    = "${var.project_name}-cognito-post-authentication"
  role             = aws_iam_role.lambda_execution[0].arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.post_authentication_zip[0].output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30

  tags = var.tags
}

resource "aws_lambda_function" "pre_token_generation" {
  count            = var.enable_lambda_triggers ? 1 : 0
  filename         = "lambda/pre_token_generation.zip"
  function_name    = "${var.project_name}-cognito-pre-token-generation"
  role             = aws_iam_role.lambda_execution[0].arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.pre_token_generation_zip[0].output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30

  tags = var.tags
}

resource "aws_lambda_function" "user_migration" {
  count            = var.enable_lambda_triggers ? 1 : 0
  filename         = "lambda/user_migration.zip"
  function_name    = "${var.project_name}-cognito-user-migration"
  role             = aws_iam_role.lambda_execution[0].arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.user_migration_zip[0].output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30

  tags = var.tags
}

# IAM Role for Lambda execution
resource "aws_iam_role" "lambda_execution" {
  count = var.enable_lambda_triggers ? 1 : 0
  name  = "${var.project_name}-cognito-lambda-execution-role"

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

# IAM Policy for Lambda execution
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  count      = var.enable_lambda_triggers ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_execution[0].name
}

resource "aws_iam_role_policy" "lambda_cognito_policy" {
  count = var.enable_lambda_triggers ? 1 : 0
  name  = "${var.project_name}-cognito-lambda-policy"
  role  = aws_iam_role.lambda_execution[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminSetUserPassword"
        ]
        Resource = aws_cognito_user_pool.main.arn
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
          "rds:DescribeDBInstances"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda permissions for Cognito triggers
resource "aws_lambda_permission" "cognito_pre_signup" {
  count         = var.enable_lambda_triggers ? 1 : 0
  statement_id  = "AllowCognitoPreSignup"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup[0].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_post_confirmation" {
  count         = var.enable_lambda_triggers ? 1 : 0
  statement_id  = "AllowCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation[0].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_pre_authentication" {
  count         = var.enable_lambda_triggers ? 1 : 0
  statement_id  = "AllowCognitoPreAuthentication"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_authentication[0].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_post_authentication" {
  count         = var.enable_lambda_triggers ? 1 : 0
  statement_id  = "AllowCognitoPostAuthentication"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_authentication[0].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_pre_token_generation" {
  count         = var.enable_lambda_triggers ? 1 : 0
  statement_id  = "AllowCognitoPreTokenGeneration"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_token_generation[0].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

resource "aws_lambda_permission" "cognito_user_migration" {
  count         = var.enable_lambda_triggers ? 1 : 0
  statement_id  = "AllowCognitoUserMigration"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.user_migration[0].function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# Archive files for Lambda functions
data "archive_file" "pre_signup_zip" {
  count       = var.enable_lambda_triggers ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda/pre_signup"
  output_path = "${path.module}/lambda/pre_signup.zip"
}

data "archive_file" "post_confirmation_zip" {
  count       = var.enable_lambda_triggers ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda/post_confirmation"
  output_path = "${path.module}/lambda/post_confirmation.zip"
}

data "archive_file" "pre_authentication_zip" {
  count       = var.enable_lambda_triggers ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda/pre_authentication"
  output_path = "${path.module}/lambda/pre_authentication.zip"
}

data "archive_file" "post_authentication_zip" {
  count       = var.enable_lambda_triggers ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda/post_authentication"
  output_path = "${path.module}/lambda/post_authentication.zip"
}

data "archive_file" "pre_token_generation_zip" {
  count       = var.enable_lambda_triggers ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda/pre_token_generation"
  output_path = "${path.module}/lambda/pre_token_generation.zip"
}

data "archive_file" "user_migration_zip" {
  count       = var.enable_lambda_triggers ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda/user_migration"
  output_path = "${path.module}/lambda/user_migration.zip"
}

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "lambda_logs" {
  count             = var.enable_lambda_triggers ? 6 : 0
  name              = "/aws/lambda/${var.project_name}-cognito-${local.lambda_function_names[count.index]}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = var.tags
}

locals {
  lambda_function_names = [
    "pre-signup",
    "post-confirmation",
    "pre-authentication",
    "post-authentication",
    "pre-token-generation",
    "user-migration"
  ]
}