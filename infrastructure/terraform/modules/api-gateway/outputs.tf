# API Gateway Module Outputs

# ============================================================================
# API Gateway Information
# ============================================================================

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_gateway_arn" {
  description = "ARN of the API Gateway"
  value       = aws_api_gateway_rest_api.main.arn
}

output "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = aws_api_gateway_rest_api.main.execution_arn
}

output "api_gateway_root_resource_id" {
  description = "Root resource ID of the API Gateway"
  value       = aws_api_gateway_rest_api.main.root_resource_id
}

# ============================================================================
# API Gateway URLs
# ============================================================================

output "api_gateway_url" {
  description = "Base URL of the API Gateway"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.region}.amazonaws.com/${aws_api_gateway_stage.main.stage_name}"
}

output "api_gateway_invoke_url" {
  description = "Invoke URL of the API Gateway"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "custom_domain_url" {
  description = "Custom domain URL (if configured)"
  value       = var.custom_domain_name != "" ? "https://${var.custom_domain_name}" : ""
}

# ============================================================================
# Stage Information
# ============================================================================

output "stage_name" {
  description = "Name of the API Gateway stage"
  value       = aws_api_gateway_stage.main.stage_name
}

output "stage_arn" {
  description = "ARN of the API Gateway stage"
  value       = aws_api_gateway_stage.main.arn
}

# ============================================================================
# Authorizers
# ============================================================================

output "cognito_authorizer_id" {
  description = "ID of the Cognito authorizer"
  value       = aws_api_gateway_authorizer.cognito.id
}

output "lambda_authorizer_id" {
  description = "ID of the Lambda authorizer"
  value       = aws_api_gateway_authorizer.lambda.id
}

output "authorizer_lambda_arn" {
  description = "ARN of the authorizer Lambda function"
  value       = aws_lambda_function.authorizer.arn
}

# ============================================================================
# Usage Plan and API Keys
# ============================================================================

output "usage_plan_id" {
  description = "ID of the API Gateway usage plan"
  value       = aws_api_gateway_usage_plan.main.id
}

output "api_key_ids" {
  description = "Map of service names to API key IDs"
  value       = { for k, v in aws_api_gateway_api_key.service_keys : k => v.id }
}

output "api_key_values" {
  description = "Map of service names to API key values"
  value       = { for k, v in aws_api_gateway_api_key.service_keys : k => v.value }
  sensitive   = true
}

# ============================================================================
# Request Validators
# ============================================================================

output "body_validator_id" {
  description = "ID of the body request validator"
  value       = aws_api_gateway_request_validator.body_validator.id
}

output "params_validator_id" {
  description = "ID of the parameters request validator"
  value       = aws_api_gateway_request_validator.params_validator.id
}

output "full_validator_id" {
  description = "ID of the full request validator"
  value       = aws_api_gateway_request_validator.full_validator.id
}

# ============================================================================
# Models
# ============================================================================

output "error_model_name" {
  description = "Name of the error response model"
  value       = aws_api_gateway_model.error.name
}

output "success_model_name" {
  description = "Name of the success response model"
  value       = aws_api_gateway_model.success.name
}

# ============================================================================
# CloudWatch Logging
# ============================================================================

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.api_gateway.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.api_gateway.arn
}

# ============================================================================
# WAF Information
# ============================================================================

output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL (if enabled)"
  value       = var.enable_waf ? aws_wafv2_web_acl.api_gateway[0].id : null
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL (if enabled)"
  value       = var.enable_waf ? aws_wafv2_web_acl.api_gateway[0].arn : null
}

# ============================================================================
# Security Information
# ============================================================================

output "gateway_invocation_role_arn" {
  description = "ARN of the API Gateway invocation role"
  value       = aws_iam_role.gateway_invocation_role.arn
}

output "authorizer_role_arn" {
  description = "ARN of the Lambda authorizer role"
  value       = aws_iam_role.authorizer_role.arn
}

# ============================================================================
# Deployment Information
# ============================================================================

output "deployment_id" {
  description = "ID of the API Gateway deployment"
  value       = aws_api_gateway_deployment.main.id
}


# ============================================================================
# Service Integration Information
# ============================================================================

output "service_endpoints" {
  description = "Map of service endpoints through API Gateway"
  value = {
    auth        = "${aws_api_gateway_stage.main.invoke_url}/auth"
    game        = "${aws_api_gateway_stage.main.invoke_url}/game"
    leaderboard = "${aws_api_gateway_stage.main.invoke_url}/leaderboard"
    support     = "${aws_api_gateway_stage.main.invoke_url}/support"
  }
}

# ============================================================================
# WebSocket API Information
# ============================================================================

output "websocket_api_id" {
  description = "ID of the WebSocket API"
  value       = aws_apigatewayv2_api.websocket.id
}

output "websocket_api_endpoint" {
  description = "WebSocket API endpoint"
  value       = aws_apigatewayv2_api.websocket.api_endpoint
}

output "websocket_stage_url" {
  description = "WebSocket stage URL"
  value       = aws_apigatewayv2_stage.websocket.invoke_url
}

output "websocket_connection_url" {
  description = "WebSocket connection URL for clients"
  value       = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.region}.amazonaws.com/${var.environment}"
}
