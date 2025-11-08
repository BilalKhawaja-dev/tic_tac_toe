# Network Infrastructure Module

This Terraform module creates a comprehensive network infrastructure for the Global Gaming Platform on AWS, implementing a three-tier architecture with security best practices.

## Architecture

### Network Tiers

1. **Public Subnets** (Web Tier)
   - Application Load Balancers
   - NAT Gateways
   - Bastion hosts (if needed)

2. **Private Subnets** (Application Tier)
   - ECS Fargate services
   - Lambda functions
   - ElastiCache clusters

3. **Isolated Subnets** (Database Tier)
   - RDS Aurora clusters
   - No internet access

### High Availability

- **Multi-AZ Deployment**: Resources distributed across 3 Availability Zones
- **NAT Gateway Redundancy**: One NAT Gateway per AZ for high availability
- **Cross-AZ Load Balancing**: ALB distributes traffic across all AZs

### Security Features

- **Security Groups**: Least privilege access with specific port/protocol rules
- **Network ACLs**: Optional subnet-level security controls
- **VPC Flow Logs**: Network traffic monitoring and analysis
- **VPC Endpoints**: Secure access to AWS services without internet routing

## Usage

### Basic Usage

```hcl
module "network" {
  source = "./modules/network"

  project_name = "global-gaming-platform"
  environment  = "production"
  vpc_cidr     = "10.0.0.0/16"

  tags = {
    Project     = "global-gaming-platform"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

### Advanced Configuration

```hcl
module "network" {
  source = "./modules/network"

  project_name = "global-gaming-platform"
  environment  = "production"
  vpc_cidr     = "10.0.0.0/16"

  # Cost optimization for non-production
  single_nat_gateway = false
  
  # Enhanced security
  enable_network_acls = true
  enable_ssh_access   = false
  
  # VPC endpoints for cost optimization
  enable_vpc_endpoints = true
  
  # Flow logs configuration
  enable_flow_logs         = true
  flow_log_retention_days  = 90
  flow_log_traffic_type    = "ALL"

  tags = {
    Project     = "global-gaming-platform"
    Environment = "production"
    ManagedBy   = "terraform"
    Component   = "network"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| project_name | Name of the project | `string` | `"global-gaming-platform"` | no |
| vpc_cidr | CIDR block for VPC | `string` | `"10.0.0.0/16"` | no |
| environment | Environment name | `string` | n/a | yes |
| flow_log_retention_days | VPC flow logs retention period | `number` | `30` | no |
| enable_nat_gateway | Enable NAT Gateway for private subnets | `bool` | `true` | no |
| single_nat_gateway | Use single NAT Gateway (cost optimization) | `bool` | `false` | no |
| enable_vpc_endpoints | Enable VPC endpoints for AWS services | `bool` | `true` | no |
| enable_network_acls | Enable custom Network ACLs | `bool` | `false` | no |
| enable_ssh_access | Enable SSH access to private instances | `bool` | `false` | no |
| tags | Tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

### VPC Information
- `vpc_id` - ID of the VPC
- `vpc_cidr_block` - CIDR block of the VPC
- `vpc_arn` - ARN of the VPC

### Subnets
- `public_subnet_ids` - IDs of public subnets
- `private_subnet_ids` - IDs of private subnets
- `isolated_subnet_ids` - IDs of isolated subnets

### Security Groups
- `alb_security_group_id` - ALB security group ID
- `ecs_security_group_id` - ECS security group ID
- `rds_security_group_id` - RDS security group ID
- `elasticache_security_group_id` - ElastiCache security group ID
- `lambda_security_group_id` - Lambda security group ID

### Subnet Groups
- `database_subnet_group_name` - RDS subnet group name
- `cache_subnet_group_name` - ElastiCache subnet group name
- `dax_subnet_group_name` - DAX subnet group name

## Security Groups

### ALB Security Group
- **Inbound**: HTTP (80), HTTPS (443) from anywhere
- **Outbound**: All traffic

### ECS Security Group
- **Inbound**: Dynamic ports from ALB, inter-service communication
- **Outbound**: All traffic

### RDS Security Group
- **Inbound**: PostgreSQL (5432) from ECS and Lambda
- **Outbound**: None

### ElastiCache Security Group
- **Inbound**: Redis (6379) from ECS and Lambda
- **Outbound**: None

### Lambda Security Group
- **Inbound**: None
- **Outbound**: All traffic

## VPC Endpoints

The module creates VPC endpoints for:
- **S3** - Gateway endpoint for S3 access
- **DynamoDB** - Gateway endpoint for DynamoDB access
- **ECR API** - Interface endpoint for ECR API calls
- **ECR DKR** - Interface endpoint for Docker image pulls
- **CloudWatch Logs** - Interface endpoint for log streaming

## Network ACLs (Optional)

When `enable_network_acls = true`, the module creates:

### Public Subnet ACL
- Allow HTTP/HTTPS inbound
- Allow ephemeral ports for return traffic
- Allow all outbound

### Private Subnet ACL
- Allow all traffic from VPC
- Allow ephemeral ports for return traffic
- Allow all outbound

### Isolated Subnet ACL
- Allow PostgreSQL from private subnets only
- Allow Redis from VPC
- Allow return traffic to VPC

## Cost Optimization

### Development/Staging
```hcl
# Reduce costs for non-production environments
single_nat_gateway = true
enable_vpc_endpoints = true  # Reduces NAT Gateway data transfer costs
flow_log_retention_days = 7
```

### Production
```hcl
# High availability and security for production
single_nat_gateway = false  # NAT Gateway per AZ
enable_vpc_endpoints = true
enable_network_acls = true
flow_log_retention_days = 90
```

## Monitoring

### VPC Flow Logs
- Captures network traffic metadata
- Stored in CloudWatch Logs
- Configurable retention period
- Can be analyzed with CloudWatch Insights

### CloudWatch Metrics
- NAT Gateway metrics (bytes, packets, errors)
- VPC endpoint metrics
- Network ACL metrics

## Best Practices Implemented

1. **Multi-AZ Deployment** - Resources across 3 AZs for high availability
2. **Least Privilege Security** - Security groups with minimal required access
3. **Network Segmentation** - Three-tier architecture with isolated database layer
4. **Cost Optimization** - VPC endpoints reduce NAT Gateway costs
5. **Monitoring** - VPC Flow Logs for network visibility
6. **Scalability** - Auto-scaling friendly subnet design
7. **Security** - Optional Network ACLs for defense in depth

## Dependencies

- AWS Provider ~> 5.0
- Terraform >= 1.6.0

## Examples

See the `examples/` directory for complete usage examples:
- `examples/development/` - Development environment setup
- `examples/production/` - Production environment setup
- `examples/multi-region/` - Multi-region deployment

## Troubleshooting

### Common Issues

1. **NAT Gateway costs too high**
   - Set `single_nat_gateway = true` for non-production
   - Enable VPC endpoints to reduce data transfer

2. **Security group rules too restrictive**
   - Check security group outputs and adjust as needed
   - Use VPC Flow Logs to identify blocked traffic

3. **Subnet capacity issues**
   - Adjust VPC CIDR block size
   - Review subnet allocation strategy

### Debugging

```bash
# Check VPC Flow Logs
aws logs describe-log-groups --log-group-name-prefix "/aws/vpc/flowlogs"

# Analyze network traffic
aws logs start-query --log-group-name "/aws/vpc/flowlogs/global-gaming-platform" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, srcaddr, dstaddr, srcport, dstport, protocol, action'
```