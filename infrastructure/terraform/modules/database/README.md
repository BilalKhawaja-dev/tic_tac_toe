# Database Infrastructure Module

This Terraform module creates a comprehensive database layer for the Global Gaming Platform, implementing Aurora Global Database, DynamoDB tables with Global Tables, ElastiCache Redis cluster, and DAX acceleration for sub-millisecond response times.

## Architecture

### Multi-Tier Database Strategy

1. **Aurora PostgreSQL Global Database** - Relational data with global replication
2. **DynamoDB with Global Tables** - NoSQL game state with multi-region replication
3. **ElastiCache Redis** - High-performance caching layer
4. **DAX** - DynamoDB acceleration for sub-millisecond latency

### Data Distribution

- **Aurora**: User profiles, statistics, support tickets, game sessions
- **DynamoDB**: Real-time game state, moves, leaderboards, user sessions
- **Redis**: Session caching, temporary data, rate limiting
- **DAX**: Accelerated DynamoDB access for hot data

## Components

### Aurora Global Database

- **Primary Cluster**: eu-west-2 with 2 instances (configurable)
- **Global Replication**: Cross-region disaster recovery
- **Encryption**: Customer-managed KMS keys with rotation
- **Monitoring**: Performance Insights and Enhanced Monitoring
- **Backup**: Automated backups with 7-day retention (configurable)

### DynamoDB Tables

- **Games Table**: Real-time game state with TTL cleanup
- **Game Moves Table**: Detailed move history and analytics
- **Leaderboard Table**: Global and regional rankings
- **User Sessions Table**: Active session management with TTL

### ElastiCache Redis

- **Cluster Mode**: Multi-AZ with automatic failover
- **Encryption**: At-rest and in-transit encryption
- **Authentication**: Auth token protection
- **Monitoring**: CloudWatch metrics and slow log analysis

### DAX Cluster

- **High Availability**: 3-node cluster across AZs
- **Microsecond Latency**: Sub-millisecond DynamoDB acceleration
- **Encryption**: Server-side encryption enabled
- **Integration**: Seamless DynamoDB API compatibility

## Usage

### Basic Usage

```hcl
module "database" {
  source = "./modules/database"

  project_name = "global-gaming-platform"
  environment  = "production"

  # Network configuration
  isolated_subnet_ids         = module.network.isolated_subnet_ids
  private_subnet_ids          = module.network.private_subnet_ids
  rds_security_group_id       = module.network.rds_security_group_id
  lambda_security_group_id    = module.network.lambda_security_group_id
  elasticache_security_group_id = module.network.elasticache_security_group_id
  dax_security_group_id       = module.network.dax_security_group_id

  # Security configuration
  rds_kms_key_arn      = module.security.rds_kms_key_arn
  database_secret_arn  = module.security.database_secret_arn
  redis_kms_key_arn    = module.security.main_kms_key_arn
  dynamodb_kms_key_arn = module.security.main_kms_key_arn

  # Database credentials
  master_username = "gameadmin"
  master_password = var.database_password
  redis_auth_token = var.redis_auth_token

  # SNS topics for alerts
  critical_sns_topic_arn = module.monitoring.sns_topic_arns.critical
  warning_sns_topic_arn  = module.monitoring.sns_topic_arns.warning
  info_sns_topic_arn     = module.monitoring.sns_topic_arns.info

  tags = {
    Project     = "global-gaming-platform"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

### Advanced Configuration

```hcl
module "database" {
  source = "./modules/database"

  project_name = "global-gaming-platform"
  environment  = "production"

  # Network configuration
  isolated_subnet_ids         = module.network.isolated_subnet_ids
  private_subnet_ids          = module.network.private_subnet_ids
  rds_security_group_id       = module.network.rds_security_group_id
  lambda_security_group_id    = module.network.lambda_security_group_id
  elasticache_security_group_id = module.network.elasticache_security_group_id
  dax_security_group_id       = module.network.dax_security_group_id

  # Aurora configuration
  aurora_engine_version     = "15.4"
  primary_instance_count    = 3
  primary_instance_class    = "db.r6g.xlarge"
  backup_retention_period   = 14
  enable_performance_insights = true
  performance_insights_retention = 31

  # DynamoDB configuration
  dynamodb_billing_mode        = "PAY_PER_REQUEST"
  enable_point_in_time_recovery = true
  enable_global_tables         = true
  secondary_region            = "eu-west-1"

  # ElastiCache configuration
  redis_engine_version    = "7.0"
  redis_node_type        = "cache.r7g.xlarge"
  redis_num_cache_nodes  = 3
  redis_multi_az_enabled = true
  redis_snapshot_retention_limit = 7

  # DAX configuration
  dax_node_type         = "dax.r4.xlarge"
  dax_replication_factor = 3

  # Security configuration
  rds_kms_key_arn      = module.security.rds_kms_key_arn
  database_secret_arn  = module.security.database_secret_arn
  redis_kms_key_arn    = module.security.main_kms_key_arn
  dynamodb_kms_key_arn = module.security.main_kms_key_arn

  # Credentials
  master_username  = "gameadmin"
  master_password  = var.database_password
  redis_auth_token = var.redis_auth_token

  # Monitoring
  critical_sns_topic_arn = module.monitoring.sns_topic_arns.critical
  warning_sns_topic_arn  = module.monitoring.sns_topic_arns.warning
  info_sns_topic_arn     = module.monitoring.sns_topic_arns.info

  tags = {
    Project     = "global-gaming-platform"
    Environment = "production"
    ManagedBy   = "terraform"
    Component   = "database"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| project_name | Name of the project | `string` | `"global-gaming-platform"` | no |
| environment | Environment name | `string` | n/a | yes |
| isolated_subnet_ids | Isolated subnet IDs for Aurora | `list(string)` | n/a | yes |
| private_subnet_ids | Private subnet IDs for caching | `list(string)` | n/a | yes |
| rds_security_group_id | RDS security group ID | `string` | n/a | yes |
| rds_kms_key_arn | KMS key ARN for RDS encryption | `string` | n/a | yes |
| database_secret_arn | Database credentials secret ARN | `string` | n/a | yes |
| master_password | Database master password | `string` | n/a | yes |
| redis_auth_token | Redis authentication token | `string` | n/a | yes |
| aurora_engine_version | Aurora PostgreSQL version | `string` | `"15.4"` | no |
| primary_instance_count | Number of Aurora instances | `number` | `2` | no |
| primary_instance_class | Aurora instance class | `string` | `"db.r6g.large"` | no |
| dynamodb_billing_mode | DynamoDB billing mode | `string` | `"PAY_PER_REQUEST"` | no |
| redis_node_type | Redis node type | `string` | `"cache.r7g.large"` | no |
| dax_node_type | DAX node type | `string` | `"dax.r4.large"` | no |

## Outputs

### Aurora Database
- `primary_cluster_endpoint` - Aurora writer endpoint
- `primary_cluster_reader_endpoint` - Aurora reader endpoint
- `primary_cluster_port` - Aurora port number
- `primary_cluster_database_name` - Database name

### DynamoDB Tables
- `dynamodb_table_names` - Map of DynamoDB table names
- `dynamodb_table_arns` - Map of DynamoDB table ARNs
- `dynamodb_stream_arns` - DynamoDB stream ARNs

### ElastiCache Redis
- `redis_primary_endpoint` - Redis primary endpoint
- `redis_reader_endpoint` - Redis reader endpoint
- `redis_port` - Redis port number

### DAX Cluster
- `dax_cluster_address` - DAX cluster endpoint
- `dax_port` - DAX port number

## Database Schema

### Aurora PostgreSQL Tables

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);
```

#### User Stats Table
```sql
CREATE TABLE user_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    rank_points INTEGER DEFAULT 1000,
    rank_tier VARCHAR(20) DEFAULT 'Bronze',
    achievements JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### DynamoDB Tables

#### Games Table
```json
{
  "gameId": "game_12345",
  "timestamp": 1699123456789,
  "playerId": "user_67890",
  "status": "active",
  "gameData": {
    "board": ["X", "", "O", "", "X", "", "", "", ""],
    "currentPlayer": "O",
    "moves": 3
  },
  "createdAt": 1699123456789,
  "ttl": 1699209856
}
```

#### Leaderboard Table
```json
{
  "leaderboardType": "global",
  "score": 2500,
  "playerId": "user_12345",
  "playerName": "ProGamer",
  "region": "eu-west-2",
  "rank": 1,
  "lastUpdated": 1699123456789
}
```

## Performance Optimization

### Aurora Optimization

- **Connection Pooling**: Use connection pooling in applications
- **Read Replicas**: Distribute read traffic across replicas
- **Parameter Tuning**: Optimized PostgreSQL parameters
- **Performance Insights**: Monitor query performance

### DynamoDB Optimization

- **Partition Key Design**: Distribute load evenly across partitions
- **Global Secondary Indexes**: Optimize query patterns
- **DAX Integration**: Sub-millisecond latency for hot data
- **TTL**: Automatic cleanup of expired data

### Redis Optimization

- **Memory Policy**: LRU eviction for optimal memory usage
- **Cluster Mode**: Horizontal scaling across nodes
- **Pipeline**: Batch operations for better throughput
- **Connection Pooling**: Reuse connections efficiently

## Monitoring and Alerting

### CloudWatch Metrics

- **Aurora**: CPU, connections, latency, throughput
- **DynamoDB**: Read/write capacity, throttling, errors
- **Redis**: CPU, memory, evictions, hit ratio
- **DAX**: Request count, error rate, latency

### CloudWatch Alarms

- High CPU utilization (>80%)
- High connection count (>80% of max)
- Read/write latency spikes (>200ms)
- DynamoDB throttling events
- Redis memory pressure
- DAX error rates

### Performance Insights

- **Aurora**: Query performance analysis
- **Slow Query Logs**: Identify performance bottlenecks
- **Wait Events**: Database contention analysis

## Backup and Recovery

### Aurora Backup Strategy

- **Automated Backups**: Daily backups with 7-day retention
- **Point-in-Time Recovery**: Restore to any second within retention
- **Cross-Region Snapshots**: Manual snapshots for disaster recovery
- **Global Database**: Cross-region replication for HA

### DynamoDB Backup Strategy

- **Point-in-Time Recovery**: Continuous backups for 35 days
- **On-Demand Backups**: Manual backups for long-term retention
- **Global Tables**: Multi-region replication
- **Cross-Region Backup**: Automated backup replication

### Redis Backup Strategy

- **Automated Snapshots**: Daily snapshots with 5-day retention
- **Manual Snapshots**: On-demand backup creation
- **Multi-AZ**: Automatic failover for high availability

## Security Features

### Encryption

- **Aurora**: Encryption at rest with customer-managed KMS keys
- **DynamoDB**: Server-side encryption with KMS
- **Redis**: At-rest and in-transit encryption
- **DAX**: Server-side encryption enabled

### Network Security

- **VPC Isolation**: Database resources in isolated subnets
- **Security Groups**: Least privilege network access
- **No Public Access**: All databases in private subnets

### Access Control

- **IAM Roles**: Service-specific database access
- **Database Authentication**: Strong password policies
- **Redis Auth**: Token-based authentication
- **Secrets Manager**: Secure credential storage

## Cost Optimization

### Development/Staging

```hcl
# Reduced capacity for non-production
primary_instance_count = 1
primary_instance_class = "db.r6g.large"
redis_num_cache_nodes = 1
dax_replication_factor = 1
dynamodb_billing_mode = "PAY_PER_REQUEST"
backup_retention_period = 3
enable_performance_insights = false
```

### Production

```hcl
# Full capacity for production
primary_instance_count = 3
primary_instance_class = "db.r6g.xlarge"
redis_num_cache_nodes = 3
dax_replication_factor = 3
dynamodb_billing_mode = "PAY_PER_REQUEST"
backup_retention_period = 14
enable_performance_insights = true
```

## Best Practices Implemented

1. **Multi-AZ Deployment** - High availability across zones
2. **Encryption Everywhere** - All data encrypted at rest and transit
3. **Automated Backups** - Comprehensive backup strategies
4. **Performance Monitoring** - Detailed metrics and alerting
5. **Security Hardening** - Network isolation and access controls
6. **Cost Optimization** - Right-sizing and efficient billing modes
7. **Global Distribution** - Multi-region replication for DR

## Troubleshooting

### Common Issues

1. **High Aurora CPU**
   - Check slow query logs
   - Optimize query performance
   - Consider read replicas

2. **DynamoDB throttling**
   - Review partition key design
   - Enable auto-scaling
   - Use DAX for hot data

3. **Redis memory pressure**
   - Adjust eviction policy
   - Increase node size
   - Implement data expiration

### Debugging Commands

```bash
# Check Aurora performance
aws rds describe-db-clusters --db-cluster-identifier global-gaming-platform-aurora-cluster

# Monitor DynamoDB metrics
aws dynamodb describe-table --table-name global-gaming-platform-games

# Check Redis cluster status
aws elasticache describe-replication-groups --replication-group-id global-gaming-platform-redis

# Monitor DAX cluster
aws dax describe-clusters --cluster-names global-gaming-platform-dax
```

## Dependencies

- AWS Provider ~> 5.0
- Terraform >= 1.6.0
- Archive Provider (for Lambda functions)
- Network module (for subnets and security groups)
- Security module (for KMS keys and secrets)
- Monitoring module (for SNS topics)

## Migration Considerations

- **Zero-Downtime Migration**: Use Aurora Global Database for migrations
- **Data Consistency**: Implement proper transaction handling
- **Performance Testing**: Load test before production deployment
- **Rollback Strategy**: Maintain backup and rollback procedures