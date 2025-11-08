# Security Infrastructure Module

This Terraform module creates a comprehensive security infrastructure for the Global Gaming Platform, implementing zero-trust security principles, encryption at rest and in transit, and comprehensive audit logging.

## Security Architecture

### Zero-Trust Principles

1. **Least Privilege Access** - IAM roles with minimal required permissions
2. **Encryption Everywhere** - KMS encryption for all data at rest and in transit
3. **Comprehensive Auditing** - CloudTrail logging of all API calls and data events
4. **Continuous Monitoring** - GuardDuty, Security Hub, and Config for threat detection
5. **Secrets Management** - AWS Secrets Manager for all sensitive credentials

### Compliance Framework

- **GDPR** - Data encryption, audit trails, and access controls
- **ISO 27001** - Information security management system
- **SOC 2 Type II** - Security, availability, and confidentiality controls

## Components

### KMS Encryption Keys

- **Main KMS Key** - General purpose encryption for secrets and logs
- **RDS KMS Key** - Database encryption with automatic rotation
- **S3 KMS Key** - Object storage encryption for audit logs and backups

### IAM Roles and Policies

- **ECS Task Execution Role** - Container startup and secrets access
- **ECS Task Role** - Application runtime permissions
- **Lambda Execution Role** - Serverless function permissions
- **CloudTrail Role** - Audit log delivery to CloudWatch

### Secrets Management

- **Database Credentials** - RDS master user credentials
- **Redis Authentication** - ElastiCache auth token
- **JWT Signing Key** - Application authentication tokens
- **OAuth Credentials** - Social login provider credentials

### Audit and Compliance

- **CloudTrail** - Multi-region API call logging with S3 storage
- **GuardDuty** - Threat detection and anomaly monitoring
- **Security Hub** - Centralized security findings dashboard
- **Config** - Resource configuration compliance monitoring
- **IAM Access Analyzer** - External access analysis

## Usage

### Basic Usage

```hcl
module "security" {
  source = "./modules/security"

  project_name = "global-gaming-platform"
  environment  = "production"

  # Database credentials
  database_username = "gameadmin"
  database_password = var.database_password
  database_name     = "gamedb"

  # Redis authentication
  redis_auth_token = var.redis_auth_token

  # JWT configuration
  jwt_signing_key = var.jwt_signing_key

  # OAuth credentials
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret

  tags = {
    Project     = "global-gaming-platform"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

### Advanced Configuration

```hcl
module "security" {
  source = "./modules/security"

  project_name = "global-gaming-platform"
  environment  = "production"

  # KMS configuration
  kms_deletion_window = 30

  # Secrets configuration
  secrets_recovery_window = 30

  # CloudTrail configuration
  cloudtrail_log_retention_days = 2555  # 7 years
  enable_cloudtrail_insights    = true
  enable_cloudtrail_data_events = true

  # Security services
  enable_guardduty        = true
  enable_security_hub     = true
  enable_config          = true
  enable_iam_access_analyzer = true

  # Backup configuration
  enable_backup_vault    = true
  backup_retention_days  = 90

  # IAM password policy
  password_policy = {
    minimum_password_length        = 16
    require_lowercase_characters   = true
    require_uppercase_characters   = true
    require_numbers               = true
    require_symbols               = true
    allow_users_to_change_password = true
    max_password_age              = 60
    password_reuse_prevention     = 24
  }

  # Credentials (use variables or external secrets)
  database_password = var.database_password
  redis_auth_token  = var.redis_auth_token
  jwt_signing_key   = var.jwt_signing_key

  tags = {
    Project     = "global-gaming-platform"
    Environment = "production"
    ManagedBy   = "terraform"
    Component   = "security"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| project_name | Name of the project | `string` | `"global-gaming-platform"` | no |
| environment | Environment name | `string` | n/a | yes |
| database_password | Database master password | `string` | n/a | yes |
| redis_auth_token | Redis authentication token | `string` | n/a | yes |
| jwt_signing_key | JWT signing key | `string` | n/a | yes |
| kms_deletion_window | KMS key deletion window (days) | `number` | `7` | no |
| secrets_recovery_window | Secrets recovery window (days) | `number` | `7` | no |
| cloudtrail_log_retention_days | CloudTrail log retention (days) | `number` | `2555` | no |
| enable_guardduty | Enable AWS GuardDuty | `bool` | `true` | no |
| enable_security_hub | Enable AWS Security Hub | `bool` | `true` | no |
| enable_config | Enable AWS Config | `bool` | `true` | no |
| tags | Tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

### KMS Keys
- `main_kms_key_arn` - Main KMS key ARN
- `rds_kms_key_arn` - RDS KMS key ARN
- `s3_kms_key_arn` - S3 KMS key ARN

### IAM Roles
- `ecs_task_execution_role_arn` - ECS task execution role ARN
- `ecs_task_role_arn` - ECS task role ARN
- `lambda_execution_role_arn` - Lambda execution role ARN

### Secrets
- `database_secret_arn` - Database credentials secret ARN
- `redis_secret_arn` - Redis credentials secret ARN
- `jwt_secret_arn` - JWT signing key secret ARN
- `oauth_secret_arn` - OAuth credentials secret ARN

### Audit and Compliance
- `cloudtrail_arn` - CloudTrail ARN
- `cloudtrail_s3_bucket_name` - CloudTrail S3 bucket name

## Security Features

### Encryption at Rest

- **KMS Keys** - Customer-managed keys with automatic rotation
- **RDS Encryption** - Database encryption with dedicated KMS key
- **S3 Encryption** - Bucket encryption for audit logs and backups
- **Secrets Encryption** - Secrets Manager encryption with KMS

### Encryption in Transit

- **TLS 1.3** - All API communications encrypted
- **VPC Endpoints** - Private connectivity to AWS services
- **Application Layer** - HTTPS/WSS for client communications

### Access Control

- **IAM Roles** - Service-specific roles with least privilege
- **Resource Policies** - Bucket and secret access restrictions
- **Security Groups** - Network-level access controls
- **Network ACLs** - Subnet-level traffic filtering

### Audit and Monitoring

- **CloudTrail** - API call logging with integrity validation
- **GuardDuty** - Threat detection and anomaly analysis
- **Security Hub** - Centralized security findings
- **Config** - Resource configuration compliance
- **Access Analyzer** - External access identification

### Backup and Recovery

- **AWS Backup** - Automated backup of RDS and DynamoDB
- **Cross-Region Replication** - Disaster recovery capabilities
- **Point-in-Time Recovery** - Database restoration options
- **Versioned Backups** - Multiple recovery points

## Compliance Features

### GDPR Compliance

- **Data Encryption** - All personal data encrypted at rest and in transit
- **Access Logging** - Complete audit trail of data access
- **Data Retention** - Configurable retention policies
- **Right to be Forgotten** - Data deletion capabilities

### SOC 2 Type II

- **Security Controls** - Comprehensive access controls and monitoring
- **Availability Controls** - Multi-AZ deployment and backup strategies
- **Confidentiality Controls** - Encryption and access restrictions

### ISO 27001

- **Information Security Policy** - Documented security procedures
- **Risk Management** - Threat detection and response
- **Asset Management** - Resource tagging and inventory
- **Access Control** - Role-based access management

## Best Practices Implemented

1. **Defense in Depth** - Multiple layers of security controls
2. **Principle of Least Privilege** - Minimal required permissions
3. **Separation of Duties** - Role-based access segregation
4. **Continuous Monitoring** - Real-time threat detection
5. **Incident Response** - Automated alerting and response
6. **Regular Auditing** - Comprehensive logging and analysis
7. **Encryption Everywhere** - Data protection at all layers

## Cost Optimization

### Development/Staging
```hcl
# Reduce costs for non-production environments
kms_deletion_window = 7
secrets_recovery_window = 7
cloudtrail_log_retention_days = 90
enable_guardduty = false
enable_security_hub = false
enable_config = false
backup_retention_days = 7
```

### Production
```hcl
# Full security for production
kms_deletion_window = 30
secrets_recovery_window = 30
cloudtrail_log_retention_days = 2555  # 7 years
enable_guardduty = true
enable_security_hub = true
enable_config = true
backup_retention_days = 90
```

## Monitoring and Alerting

### CloudWatch Metrics
- KMS key usage and errors
- Secrets Manager access patterns
- CloudTrail log delivery status
- GuardDuty finding counts

### Security Alerts
- High-severity GuardDuty findings
- Unusual API call patterns
- Failed authentication attempts
- Resource configuration changes

## Troubleshooting

### Common Issues

1. **KMS key access denied**
   - Check IAM role permissions
   - Verify key policy allows service access

2. **Secrets Manager access failed**
   - Confirm IAM role has GetSecretValue permission
   - Check KMS key permissions for decryption

3. **CloudTrail not logging**
   - Verify S3 bucket policy allows CloudTrail
   - Check IAM role permissions

### Debugging Commands

```bash
# Check KMS key permissions
aws kms describe-key --key-id alias/global-gaming-platform-main

# Test secret access
aws secretsmanager get-secret-value --secret-id global-gaming-platform/database/credentials

# Verify CloudTrail status
aws cloudtrail get-trail-status --name global-gaming-platform-cloudtrail

# Check GuardDuty findings
aws guardduty list-findings --detector-id <detector-id>
```

## Dependencies

- AWS Provider ~> 5.0
- Terraform >= 1.6.0
- Random Provider (for bucket suffixes)

## Security Considerations

- **Sensitive Variables** - Use Terraform Cloud/Enterprise for secret management
- **State File Security** - Store Terraform state in encrypted S3 bucket
- **Access Control** - Limit Terraform execution to authorized personnel
- **Regular Updates** - Keep security services and policies updated