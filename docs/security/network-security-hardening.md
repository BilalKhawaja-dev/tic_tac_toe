# Network Security Hardening Guide

## Overview

This document outlines the network security controls implemented for the Global Gaming Platform to protect against unauthorized access, DDoS attacks, and data breaches.

## Network Architecture

### VPC Configuration

- **CIDR Block**: 10.0.0.0/16
- **Availability Zones**: 3 (for high availability)
- **Subnet Types**:
  - Public Subnets (3): For ALB and NAT Gateways
  - Private Subnets (3): For ECS services and Lambda functions
  - Isolated Subnets (3): For databases (no internet access)

### Security Groups

#### 1. ALB Security Group
- **Inbound Rules**:
  - HTTPS (443) from 0.0.0.0/0
  - HTTP (80) from 0.0.0.0/0 (redirects to HTTPS)
- **Outbound Rules**:
  - All traffic to ECS Security Group

#### 2. ECS Security Group
- **Inbound Rules**:
  - Port 3000 from ALB Security Group only
  - Port 8080 from ALB Security Group (health checks)
- **Outbound Rules**:
  - HTTPS (443) to 0.0.0.0/0 (for AWS API calls)
  - PostgreSQL (5432) to Database Security Group
  - Redis (6379) to Cache Security Group
  - DynamoDB via VPC Endpoint

#### 3. Database Security Group
- **Inbound Rules**:
  - PostgreSQL (5432) from ECS Security Group
  - PostgreSQL (5432) from Lambda Security Group
- **Outbound Rules**:
  - None (databases don't initiate outbound connections)

#### 4. Cache Security Group
- **Inbound Rules**:
  - Redis (6379) from ECS Security Group
  - Redis (6379) from Lambda Security Group
- **Outbound Rules**:
  - None

#### 5. Lambda Security Group
- **Inbound Rules**:
  - None (Lambda functions don't accept inbound connections)
- **Outbound Rules**:
  - HTTPS (443) to 0.0.0.0/0
  - PostgreSQL (5432) to Database Security Group
  - Redis (6379) to Cache Security Group

#### 6. DAX Security Group
- **Inbound Rules**:
  - Port 8111 from ECS Security Group
  - Port 8111 from Lambda Security Group
- **Outbound Rules**:
  - DynamoDB via VPC Endpoint

### Network ACLs (NACLs)

#### Public Subnet NACL
- **Inbound**:
  - Allow HTTP/HTTPS from internet
  - Allow ephemeral ports for return traffic
  - Deny all other traffic
- **Outbound**:
  - Allow HTTP/HTTPS to internet
  - Allow ephemeral ports for return traffic
  - Deny all other traffic

#### Private Subnet NACL
- **Inbound**:
  - Allow traffic from public subnets
  - Allow traffic from other private subnets
  - Deny traffic from internet
- **Outbound**:
  - Allow traffic to public subnets (for NAT)
  - Allow traffic to isolated subnets
  - Allow traffic to other private subnets

#### Isolated Subnet NACL
- **Inbound**:
  - Allow traffic from private subnets only
  - Deny all other traffic
- **Outbound**:
  - Allow traffic to private subnets only
  - Deny all other traffic

## VPC Endpoints

To reduce data transfer costs and improve security, we use VPC endpoints for AWS services:

1. **S3 Gateway Endpoint**: For S3 access without internet gateway
2. **DynamoDB Gateway Endpoint**: For DynamoDB access without internet gateway
3. **Secrets Manager Interface Endpoint**: For secure secret retrieval
4. **CloudWatch Logs Interface Endpoint**: For log streaming
5. **ECR Interface Endpoints**: For Docker image pulls

## NAT Gateway Configuration

- **Count**: 3 (one per AZ for high availability)
- **Elastic IPs**: Static IPs for outbound traffic
- **Purpose**: Allow private subnet resources to access internet for updates

## Flow Logs

VPC Flow Logs are enabled to capture information about IP traffic:

- **Destination**: CloudWatch Logs
- **Traffic Type**: ALL (accepted and rejected)
- **Retention**: 90 days
- **Encryption**: KMS encrypted

## DDoS Protection

### AWS Shield Standard
- Automatically enabled for all AWS customers
- Protects against common layer 3 and 4 attacks

### AWS WAF
- Rate limiting: 2000 requests per IP per 5 minutes
- Geographic blocking (configurable)
- SQL injection protection
- XSS protection
- Known bad inputs blocking
- IP reputation lists
- Anonymous IP blocking (VPN, Proxy, Tor)

### CloudFront (Future Enhancement)
- Additional DDoS protection at edge locations
- Geographic restrictions
- Custom SSL certificates
- Origin access identity for S3

## Encryption in Transit

### TLS/SSL Configuration

1. **ALB Listeners**:
   - TLS 1.2 minimum
   - Strong cipher suites only
   - Perfect Forward Secrecy (PFS) enabled

2. **Database Connections**:
   - SSL/TLS required for all connections
   - Certificate validation enabled

3. **Redis Connections**:
   - TLS encryption enabled
   - Auth token required

4. **Internal Service Communication**:
   - HTTPS for all API calls
   - mTLS for service-to-service (future enhancement)

## Network Monitoring

### CloudWatch Metrics
- VPC Flow Log analysis
- NAT Gateway bandwidth
- Security group rule hits
- NACL rule hits

### CloudWatch Alarms
- Unusual traffic patterns
- High rejected connection rates
- NAT Gateway bandwidth spikes
- Security group changes

### AWS GuardDuty
- Threat detection for VPC
- Unusual API calls
- Compromised instance detection
- Reconnaissance attempts

## Security Best Practices

### 1. Principle of Least Privilege
- Security groups allow only necessary ports
- NACLs provide defense in depth
- No direct internet access for databases

### 2. Defense in Depth
- Multiple layers of security (WAF, Security Groups, NACLs)
- Isolated subnets for sensitive data
- VPC endpoints to avoid internet routing

### 3. Network Segmentation
- Public, private, and isolated subnets
- Separate security groups per service
- No cross-environment traffic

### 4. Monitoring and Logging
- VPC Flow Logs enabled
- CloudWatch alarms for anomalies
- GuardDuty for threat detection

### 5. Regular Updates
- Security group rules reviewed quarterly
- NACL rules audited monthly
- WAF rules updated based on threats

## Incident Response

### Network-Related Incidents

1. **DDoS Attack**:
   - WAF automatically blocks malicious IPs
   - CloudWatch alarms notify security team
   - AWS Shield provides automatic mitigation
   - Escalate to AWS Shield Advanced if needed

2. **Unauthorized Access Attempt**:
   - Security groups block unauthorized ports
   - VPC Flow Logs capture attempt
   - GuardDuty detects reconnaissance
   - Automated response via Lambda

3. **Data Exfiltration**:
   - VPC Flow Logs show unusual outbound traffic
   - CloudWatch alarms trigger
   - Isolate affected resources
   - Review security group rules

## Compliance

### GDPR
- Data encryption in transit
- Network isolation for EU data
- VPC Flow Logs for audit trail

### PCI DSS (Future)
- Network segmentation
- Firewall rules documented
- Regular security assessments

## Maintenance

### Monthly Tasks
- Review VPC Flow Logs for anomalies
- Audit security group rules
- Update WAF rules based on threats
- Review CloudWatch alarms

### Quarterly Tasks
- Security group rule cleanup
- NACL rule optimization
- Network architecture review
- Penetration testing

### Annual Tasks
- Full network security audit
- Disaster recovery testing
- Compliance assessment
- Architecture optimization

## References

- [AWS VPC Security Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-best-practices.html)
- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [AWS Shield Documentation](https://docs.aws.amazon.com/shield/)
- [VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html)
