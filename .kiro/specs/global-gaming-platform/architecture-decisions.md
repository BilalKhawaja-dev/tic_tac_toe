# Architecture Decision Records (ADRs)

## ADR-001: Multi-Region Strategy
**Decision**: Active-passive deployment with eu-west-2 primary, eu-west-1 backup
**Rationale**: Balance between availability and operational complexity
**Alternatives Considered**: Active-active (too complex), single region (insufficient availability)

## ADR-002: Database Strategy
**Decision**: Aurora Global Database for relational data, DynamoDB Global Tables for game state
**Rationale**: Aurora for complex queries (leaderboards), DynamoDB for low-latency game operations
**Alternatives Considered**: All-DynamoDB (limited querying), All-Aurora (higher latency)

## ADR-003: Caching Strategy
**Decision**: ElastiCache Valkey for application cache, DAX for DynamoDB acceleration
**Rationale**: Valkey for modern Redis compatibility, DAX for sub-millisecond DynamoDB access
**Alternatives Considered**: Redis (older), no caching (performance issues)

## ADR-004: Compute Platform
**Decision**: ECS Fargate for containerized services
**Rationale**: Serverless containers, auto-scaling, no EC2 management overhead
**Alternatives Considered**: Lambda (15-min limit), EC2 (management overhead), EKS (complexity)

## ADR-005: Real-time Communication
**Decision**: WebSocket API Gateway with ECS backend
**Rationale**: Managed WebSocket scaling, integration with existing API Gateway
**Alternatives Considered**: Direct WebSocket on ALB (less managed), Socket.io (additional complexity)

## ADR-006: Security Model
**Decision**: Zero-trust architecture with WAF, VPC endpoints, no direct internet access
**Rationale**: Defense in depth, compliance requirements, attack surface reduction
**Alternatives Considered**: Traditional perimeter security (insufficient for modern threats)

## ADR-007: Infrastructure as Code
**Decision**: Terraform for all infrastructure deployment
**Rationale**: Multi-cloud capability, state management, extensive AWS provider
**Alternatives Considered**: CloudFormation (AWS-only), CDK (more complex), Pulumi (less mature)

## ADR-008: Monitoring Strategy
**Decision**: CloudWatch + X-Ray + custom business metrics
**Rationale**: Native AWS integration, comprehensive observability, cost-effective
**Alternatives Considered**: Third-party APM (higher cost), minimal monitoring (insufficient visibility)