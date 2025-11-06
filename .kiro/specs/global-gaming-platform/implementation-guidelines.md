# Implementation Guidelines

## Getting Started
1. **Read First**: context.md, requirements.md, design.md
2. **Start With**: Task 0.1 (Architecture Review & Sign-off)
3. **Follow Dependencies**: Each task lists its dependencies
4. **Test Everything**: All tasks include comprehensive testing

## Key Principles
- **Infrastructure as Code**: All AWS resources via Terraform
- **Security First**: Zero-trust, encryption everywhere, least privilege
- **Observability**: Metrics, logs, traces for everything
- **Resilience**: Circuit breakers, retries, graceful degradation
- **Performance**: Sub-100ms targets, caching strategies

## Critical Implementation Notes

### Terraform Structure
```
terraform/
├── environments/dev|staging|prod/
├── modules/networking|compute|database|security/
└── shared/variables.tf
```

### Service Communication
- **External**: Internet → CloudFront → WAF → ALB → API Gateway
- **Internal**: Service Mesh (App Mesh) with circuit breakers
- **Real-time**: WebSocket API Gateway → ECS services

### Data Flow
- **Game State**: DynamoDB with DAX caching
- **User Data**: Aurora with ElastiCache Valkey
- **Analytics**: Kinesis → S3 → Athena → QuickSight

### Security Requirements
- All data encrypted at rest (KMS) and in transit (TLS 1.3)
- IAM roles with least privilege, no long-term credentials
- WAF rules for DDoS protection and attack mitigation
- VPC endpoints for AWS service communication

### Testing Strategy
- Unit tests for all business logic
- Integration tests for service interactions
- Load tests for performance validation
- Chaos engineering for resilience testing

## Common Pitfalls to Avoid
1. **Don't skip testing** - Each task includes required tests
2. **Don't ignore dependencies** - Follow the task order
3. **Don't use Redis** - Use ElastiCache Valkey instead
4. **Don't hardcode values** - Use Parameter Store/Secrets Manager
5. **Don't forget monitoring** - Implement metrics from day one

## When You Need Help
- Reference the design.md for detailed technical specifications
- Check architecture-decisions.md for rationale behind choices
- Review requirements.md for functional specifications
- Follow the task dependencies in tasks.md