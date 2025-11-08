# Authentication Module Outputs

# Cognito User Pool
output "user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Endpoint of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.endpoint
}

output "user_pool_domain" {
  description = "Domain of the Cognito User Pool"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "user_pool_hosted_ui_url" {
  description = "Hosted UI URL for the Cognito User Pool"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

# Cognito User Pool Clients
output "web_client_id" {
  description = "ID of the web client"
  value       = aws_cognito_user_pool_client.web_client.id
}

output "mobile_client_id" {
  description = "ID of the mobile client"
  value       = aws_cognito_user_pool_client.mobile_client.id
}

output "mobile_client_secret" {
  description = "Secret of the mobile client"
  value       = aws_cognito_user_pool_client.mobile_client.client_secret
  sensitive   = true
}

# Cognito Identity Pool
output "identity_pool_id" {
  description = "ID of the Cognito Identity Pool"
  value       = aws_cognito_identity_pool.main.id
}

output "identity_pool_arn" {
  description = "ARN of the Cognito Identity Pool"
  value       = aws_cognito_identity_pool.main.arn
}

# IAM Roles
output "authenticated_role_arn" {
  description = "ARN of the authenticated IAM role"
  value       = aws_iam_role.authenticated.arn
}

output "unauthenticated_role_arn" {
  description = "ARN of the unauthenticated IAM role"
  value       = var.allow_unauthenticated_identities ? aws_iam_role.unauthenticated[0].arn : null
}

# OAuth Configuration
output "oauth_configuration" {
  description = "OAuth configuration details"
  value = {
    domain               = aws_cognito_user_pool_domain.main.domain
    hosted_ui_url        = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
    callback_urls        = var.callback_urls
    logout_urls          = var.logout_urls
    mobile_callback_urls = var.mobile_callback_urls
    mobile_logout_urls   = var.mobile_logout_urls
    scopes               = ["email", "openid", "profile", "aws.cognito.signin.user.admin"]
  }
}

# Social Identity Providers
output "google_provider_name" {
  description = "Name of the Google identity provider"
  value       = var.enable_google_oauth ? aws_cognito_identity_provider.google[0].provider_name : null
}

output "facebook_provider_name" {
  description = "Name of the Facebook identity provider"
  value       = var.enable_facebook_oauth ? aws_cognito_identity_provider.facebook[0].provider_name : null
}

output "amazon_provider_name" {
  description = "Name of the Amazon identity provider"
  value       = var.enable_twitter_oauth ? aws_cognito_identity_provider.amazon[0].provider_name : null
}

# Lambda Functions
output "lambda_function_arns" {
  description = "ARNs of the Lambda trigger functions"
  value = var.enable_lambda_triggers ? {
    pre_signup           = aws_lambda_function.pre_signup[0].arn
    post_confirmation    = aws_lambda_function.post_confirmation[0].arn
    pre_authentication   = aws_lambda_function.pre_authentication[0].arn
    post_authentication  = aws_lambda_function.post_authentication[0].arn
    pre_token_generation = aws_lambda_function.pre_token_generation[0].arn
    user_migration       = aws_lambda_function.user_migration[0].arn
  } : {}
}

# Authentication Configuration for Applications
output "auth_config" {
  description = "Complete authentication configuration for client applications"
  value = {
    region                     = data.aws_region.current.name
    user_pool_id               = aws_cognito_user_pool.main.id
    user_pool_web_client_id    = aws_cognito_user_pool_client.web_client.id
    user_pool_mobile_client_id = aws_cognito_user_pool_client.mobile_client.id
    identity_pool_id           = aws_cognito_identity_pool.main.id
    oauth_domain               = aws_cognito_user_pool_domain.main.domain
    oauth_scope                = ["email", "openid", "profile", "aws.cognito.signin.user.admin"]
    oauth_response_type        = "code"
    oauth_redirect_signin      = var.callback_urls[0]
    oauth_redirect_signout     = var.logout_urls[0]
    social_providers = {
      google   = var.enable_google_oauth
      facebook = var.enable_facebook_oauth
      amazon   = var.enable_twitter_oauth
    }
  }
}

# JWT Configuration
output "jwt_configuration" {
  description = "JWT token configuration"
  value = {
    issuer                 = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.main.id}"
    audience               = aws_cognito_user_pool_client.web_client.id
    access_token_validity  = var.access_token_validity_hours
    id_token_validity      = var.id_token_validity_hours
    refresh_token_validity = var.refresh_token_validity_days
    jwks_uri               = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.main.id}/.well-known/jwks.json"
  }
}

# Security Configuration
output "security_configuration" {
  description = "Security configuration details"
  value = {
    advanced_security_enabled = var.enable_advanced_security
    password_policy = {
      minimum_length    = 8
      require_lowercase = true
      require_numbers   = true
      require_symbols   = true
      require_uppercase = true
    }
    mfa_configuration = "OFF" # Can be enabled later
    account_recovery  = ["verified_email"]
  }
}

# Monitoring and Logging
output "cloudwatch_log_groups" {
  description = "CloudWatch log groups for Lambda functions"
  value = var.enable_lambda_triggers ? [
    for i in range(6) : "/aws/lambda/${var.project_name}-cognito-${local.lambda_function_names[i]}"
  ] : []
}

# Integration Endpoints
output "integration_endpoints" {
  description = "Endpoints for service integration"
  value = {
    user_pool_endpoint       = aws_cognito_user_pool.main.endpoint
    identity_pool_endpoint   = "https://cognito-identity.${data.aws_region.current.name}.amazonaws.com"
    oauth_token_endpoint     = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/oauth2/token"
    oauth_authorize_endpoint = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/oauth2/authorize"
    oauth_userinfo_endpoint  = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${data.aws_region.current.name}.amazoncognito.com/oauth2/userInfo"
  }
}

# Resource ARNs for other modules
output "resource_arns" {
  description = "ARNs of created resources for cross-module references"
  value = {
    user_pool_arn            = aws_cognito_user_pool.main.arn
    identity_pool_arn        = aws_cognito_identity_pool.main.arn
    authenticated_role_arn   = aws_iam_role.authenticated.arn
    unauthenticated_role_arn = var.allow_unauthenticated_identities ? aws_iam_role.unauthenticated[0].arn : null
  }
}