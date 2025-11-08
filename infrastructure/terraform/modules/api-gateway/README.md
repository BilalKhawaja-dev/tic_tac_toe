# API Gateway Module

This Terraform module creates a comprehensive API Gateway setup for the Global Gaming Platform, providing a unified entry point for all microservices with authentication, rate limiting, and service routing.

## Features

- **Regional API Gateway** with custom domain support
- **Dual Authentication**: Cognito JWT and Lambda-based API key validation
- **Rate Limiting**: Configurable throttling and quota management
- **Service Integration**: HTTP proxy to Auth, Game Engine, Leaderboard, and Support services
- **WebSocket Support**: Real-time communication for game engine
- **WAF Protection**: DDoS mitigation and geo-blocking
- **CORS Configuration**: Cross-origin resource sharing support
- **Request Validation**: Body and parameter validation
- **CloudWatch Logging**: Access and execution logs
- **X-Ray Tracing**: Distributed tracing support
- **API Caching**: Optional response caching

## Architecture

```
Internet → CloudFront → WAF → API Gateway → Services
                                    ├── /auth → Auth Service (ECS)
                                    ├── /game → Game Engine (ECS)
                                    ├── /leaderboard → Leaderboard Service (ECS)
                                    └── /support → Support Service (Lambda)

WebSocket → API Gateway v2 → Game Engine (ECS)
```

## Usage

```hcl
module "api_gateway" {
  source = "./modules/api-gateway"

  project_name = "gaming-platform"
  environment  = "prod"
  region       = "eu-west-2"

  # Network
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids

  # Authentication
  cognito_user_pool_arn = module.auth.user_pool_arn
  jwt_secret            = var.jwt_secret
  valid_api_keys        = var.valid_api_keys
  service_api_keys = {
    internal = "api-key-value"
    partner  = "partner-api-key"
  }

  # Service URLs
  auth_service_url        = "http://auth-service.local:3000"
  game_engine_url         = "http://game-engine.local:3000"
  leaderboard_service_url = "http://leaderboard.local:3000"
  support_service_url     = module.support.lambda_function_arn

  # Rate Limiting
  api_quota_limit = 10000
  api_rate_limit  = 100
  api_burst_limit = 200

  # WAF
  enable_waf         = true
  waf_rate_limit     = 2000
  blocked_countries  = ["XX", "YY"]

  # Caching
  enable_caching      = true
  cache_cluster_size  = "0.5"
  cache_ttl_seconds   = 300

  # Custom Domain
  custom_domain_name = "api.gaming-platform.com"
  certificate_arn    = "arn:aws:acm:..."
  route53_zone_id    = "Z1234567890ABC"

  # Monitoring
  enable_xray_tracing        = true
  cloudwatch_metrics_enabled = true
  log_retention_days         = 30
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| project_name | Name of the project | string | "gaming-platform" | no |
| environment | Environment name | string | - | yes |
| region | AWS region | string | "eu-west-2" | no |
| vpc_id | VPC ID | string | - | yes |
| private_subnet_ids | Private subnet IDs | list(string) | - | yes |
| cognito_user_pool_arn | Cognito User Pool ARN | string | - | yes |
| jwt_secret | JWT secret for validation | string | - | yes |
| auth_service_url | Auth service URL | string | - | yes |
| game_engine_url | Game engine URL | string | - | yes |
| leaderboard_service_url | Leaderboard service URL | string | - | yes |
| support_service_url | Support service URL | string | - | yes |
| api_quota_limit | Daily API quota | number | 10000 | no |
| api_rate_limit | Requests per second | number | 100 | no |
| api_burst_limit | Burst limit | number | 200 | no |
| enable_waf | Enable WAF | bool | true | no |
| enable_caching | Enable caching | bool | true | no |
| cache_cluster_size | Cache cluster size | string | "0.5" | no |
| custom_domain_name | Custom domain | string | "" | no |

## Outputs

| Name | Description |
|------|-------------|
| api_gateway_id | API Gateway ID |
| api_gateway_url | API Gateway base URL |
| api_gateway_invoke_url | API Gateway invoke URL |
| websocket_connection_url | WebSocket connection URL |
| service_endpoints | Map of service endpoints |
| cognito_authorizer_id | Cognito authorizer ID |
| lambda_authorizer_id | Lambda authorizer ID |
| usage_plan_id | Usage plan ID |
| api_key_ids | Map of API key IDs |

## Service Integration

### Authentication Service
- **Path**: `/auth/*`
- **Authorization**: None (handles its own auth)
- **Methods**: ALL
- **Type**: HTTP Proxy

### Game Engine Service
- **Path**: `/game/*`
- **Authorization**: Lambda Authorizer
- **Methods**: ALL
- **Type**: HTTP Proxy
- **Headers**: X-User-Id, X-Auth-Type

### Leaderboard Service
- **Path**: `/leaderboard/*`
- **Authorization**: Lambda Authorizer (optional for public endpoints)
- **Methods**: ALL
- **Type**: HTTP Proxy
- **Caching**: Enabled for GET requests

### Support Service
- **Path**: `/support/*`
- **Authorization**: Lambda Authorizer
- **Methods**: ALL
- **Type**: AWS Lambda Proxy

### WebSocket API
- **Routes**: $connect, $disconnect, $default
- **Target**: Game Engine WebSocket handlers
- **Type**: HTTP Proxy

## Lambda Authorizer

The Lambda authorizer validates both API keys and JWT tokens:

### API Key Authentication
- Header: `x-api-key` or `X-Api-Key`
- Query parameter: `api_key`
- Used for service-to-service communication

### JWT Authentication
- Header: `Authorization: Bearer <token>`
- Validates against JWT_SECRET
- Extracts user context (userId, email, role, permissions)

### Public Endpoints
The following endpoints don't require authentication:
- `/health`
- `/auth/oauth/url`
- `/auth/config`
- `/faq/*`
- `/leaderboard/global`
- `/leaderboard/regional`

## Rate Limiting

### API Gateway Level
- **Rate Limit**: 100 requests/second (configurable)
- **Burst Limit**: 200 requests (configurable)
- **Quota**: 10,000 requests/day (configurable)

### WAF Level
- **Rate Limit**: 2,000 requests per 5 minutes per IP
- **Geo-blocking**: Configurable country codes

## Monitoring

### CloudWatch Logs
- Access logs: Request/response details
- Execution logs: API Gateway execution details
- Lambda logs: Authorizer function logs

### CloudWatch Metrics
- Request count
- Latency (P50, P95, P99)
- 4XX/5XX errors
- Cache hit/miss ratio

### X-Ray Tracing
- End-to-end request tracing
- Service dependency mapping
- Performance bottleneck identification

## Security

### WAF Rules
1. **Rate Limiting**: Block IPs exceeding rate limits
2. **Geo-blocking**: Block requests from specific countries
3. **Common Attack Protection**: SQL injection, XSS prevention

### Encryption
- TLS 1.3 for all API traffic
- Encrypted cache data
- Encrypted CloudWatch logs

### IAM Roles
- Gateway invocation role for Lambda authorizer
- Lambda execution role with least privilege
- CloudWatch logging role

## Deployment

The module creates:
1. API Gateway REST API
2. API Gateway v2 WebSocket API
3. Lambda authorizer function
4. Service integrations (resources, methods, integrations)
5. Usage plans and API keys
6. WAF Web ACL (optional)
7. Custom domain and Route53 records (optional)
8. CloudWatch log groups
9. IAM roles and policies

## Dependencies

- VPC and subnets (from network module)
- Cognito User Pool (from auth module)
- Service URLs (from ECS and Lambda modules)
- ACM certificate (for custom domain)
- Route53 hosted zone (for custom domain)

## Notes

- The Lambda authorizer requires `jsonwebtoken` npm package
- Run `npm install` in `lambda/authorizer/` before deployment
- API Gateway has a 29-second timeout limit
- WebSocket connections have a 2-hour idle timeout
- Cache cluster incurs additional costs

## Troubleshooting

### Common Issues

1. **Lambda authorizer fails**
   - Check JWT_SECRET environment variable
   - Verify API keys in VALID_API_KEYS
   - Check CloudWatch logs for errors

2. **Service integration timeout**
   - Verify service URLs are correct
   - Check service health endpoints
   - Increase timeout if needed (max 29s)

3. **CORS errors**
   - Verify CORS configuration
   - Check OPTIONS method responses
   - Ensure headers are properly configured

4. **Rate limiting issues**
   - Check usage plan settings
   - Verify API key association
   - Review WAF rules

## References

- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [Lambda Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)
- [WAF Documentation](https://docs.aws.amazon.com/waf/)
- [WebSocket APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html)
