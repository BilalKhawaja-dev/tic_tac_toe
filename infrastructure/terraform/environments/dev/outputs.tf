# Development Environment Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.network.private_subnet_ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.network.public_subnet_ids
}

output "database_endpoint" {
  description = "Database endpoint"
  value       = module.database.aurora_endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.ecs.alb_dns_name
}

# PHASE 2 OUTPUTS - Uncomment after auth and API Gateway deployment
# output "cognito_user_pool_id" {
#   description = "Cognito User Pool ID"
#   value       = module.auth.user_pool_id
# }

# output "cognito_client_id" {
#   description = "Cognito Client ID"
#   value       = module.auth.user_pool_client_id
#   sensitive   = true
# }

# output "api_gateway_url" {
#   description = "API Gateway URL"
#   value       = module.api_gateway.api_gateway_url
# }

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = module.ecs.ecr_repository_url
}
