# API Gateway Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "gaming-platform"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

# ============================================================================
# Network Configuration
# ============================================================================

variable "vpc_id" {
  description = "VPC ID for API Gateway"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for VPC endpoints"
  type        = list(string)
}

variable "allowed_ips" {
  description = "List of allowed IP addresses/CIDR blocks"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# ============================================================================
# Authentication Configuration
# ============================================================================

variable "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool for JWT authorization"
  type        = string
}

variable "jwt_secret" {
  description = "JWT secret for token validation"
  type        = string
  sensitive   = true
}

variable "valid_api_keys" {
  description = "List of valid API keys for service authentication"
  type        = list(string)
  sensitive   = true
  default     = []
}

variable "service_api_keys" {
  description = "Map of service names to API keys"
  type        = map(string)
  sensitive   = true
  default     = {}
}

# ============================================================================
# Rate Limiting Configuration
# ============================================================================

variable "api_quota_limit" {
  description = "Daily API quota limit"
  type        = number
  default     = 10000
}

variable "api_rate_limit" {
  description = "API rate limit (requests per second)"
  type        = number
  default     = 100
}

variable "api_burst_limit" {
  description = "API burst limit"
  type        = number
  default     = 200
}

# ============================================================================
# Service Endpoints
# ============================================================================

variable "auth_service_url" {
  description = "URL of the authentication service"
  type        = string
}

variable "game_engine_url" {
  description = "URL of the game engine service"
  type        = string
}

variable "leaderboard_service_url" {
  description = "URL of the leaderboard service"
  type        = string
}

variable "support_service_url" {
  description = "URL of the support service (Lambda)"
  type        = string
}

# ============================================================================
# Logging Configuration
# ============================================================================

variable "log_level" {
  description = "Log level for Lambda functions"
  type        = string
  default     = "INFO"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "enable_access_logging" {
  description = "Enable API Gateway access logging"
  type        = bool
  default     = true
}

variable "enable_execution_logging" {
  description = "Enable API Gateway execution logging"
  type        = bool
  default     = true
}

# ============================================================================
# WAF Configuration
# ============================================================================

variable "enable_waf" {
  description = "Enable WAF for API Gateway"
  type        = bool
  default     = true
}

variable "waf_rate_limit" {
  description = "WAF rate limit (requests per 5 minutes)"
  type        = number
  default     = 2000
}

variable "blocked_countries" {
  description = "List of country codes to block"
  type        = list(string)
  default     = []
}

# ============================================================================
# CORS Configuration
# ============================================================================

variable "cors_allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = ["*"]
}

variable "cors_allowed_methods" {
  description = "List of allowed CORS methods"
  type        = list(string)
  default     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}

variable "cors_allowed_headers" {
  description = "List of allowed CORS headers"
  type        = list(string)
  default = [
    "Content-Type",
    "X-Amz-Date",
    "Authorization",
    "X-Api-Key",
    "X-Amz-Security-Token",
    "X-Amz-User-Agent"
  ]
}

# ============================================================================
# Caching Configuration
# ============================================================================

variable "enable_caching" {
  description = "Enable API Gateway caching"
  type        = bool
  default     = true
}

variable "cache_cluster_size" {
  description = "API Gateway cache cluster size"
  type        = string
  default     = "0.5"
}

variable "cache_ttl_seconds" {
  description = "Default cache TTL in seconds"
  type        = number
  default     = 300
}

# ============================================================================
# Custom Domain Configuration
# ============================================================================

variable "custom_domain_name" {
  description = "Custom domain name for API Gateway"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for custom domain"
  type        = string
  default     = ""
}

# ============================================================================
# Monitoring Configuration
# ============================================================================

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing for API Gateway"
  type        = bool
  default     = true
}

variable "cloudwatch_metrics_enabled" {
  description = "Enable CloudWatch metrics for API Gateway"
  type        = bool
  default     = true
}

variable "data_trace_enabled" {
  description = "Enable data trace logging"
  type        = bool
  default     = false
}

# ============================================================================
# Tags
# ============================================================================

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
