# Deployment Checklist

## Pre-Deployment Checklist

### AWS Account Setup
- [ ] AWS account created
- [ ] AWS CLI installed
- [ ] AWS credentials configured (`aws configure`)
- [ ] IAM permissions verified
- [ ] Billing alerts configured

### Tools Installation
- [ ] Terraform 1.6.0+ installed
- [ ] Docker installed
- [ ] Node.js 18.x installed
- [ ] Git installed

### Repository Setup
- [ ] Code pushed to GitHub
- [ ] GitHub repository created
- [ ] GitHub Actions enabled
- [ ] GitHub Secrets configured:
  - [ ] AWS_ACCESS_KEY_ID
  - [ ] AWS_SECRET_ACCESS_KEY
  - [ ] SNYK_TOKEN

---

## Terraform Deployment Checklist

### Phase 1: Backend Setup (5 minutes)
- [ ] S3 bucket created for Terraform state
- [ ] S3 versioning enabled
- [ ] S3 encryption enabled
- [ ] DynamoDB table created for state locking

### Phase 2: Configuration (10 minutes)
- [ ] `terraform.tfvars` created from example
- [ ] Alert email updated
- [ ] GitHub repo updated
- [ ] AWS region confirmed
- [ ] Cost estimate reviewed

### Phase 3: Terraform Deployment (30-45 minutes)
- [ ] Terraform initialized (`terraform init`)
- [ ] Configuration validated (`terraform validate`)
- [ ] Plan reviewed (`terraform plan`)
- [ ] Plan applied (`terraform apply`)
- [ ] Outputs saved

### Phase 4: Post-Deployment Configuration (15 minutes)
- [ ] Cognito OAuth providers configured
- [ ] Secrets stored in Secrets Manager:
  - [ ] Database password
  - [ ] JWT secret
  - [ ] OAuth client secrets
- [ ] SNS email subscription confirmed
- [ ] CloudWatch dashboards verified

---

## Application Deployment Checklist

### Phase 1: Build Docker Images (10 minutes)
- [ ] Game Engine image built
- [ ] Auth Service image built
- [ ] Leaderboard Service image built
- [ ] Support Service image built
- [ ] Images pushed to ECR

### Phase 2: Deploy Services (15 minutes)
- [ ] ECS services updated
- [ ] Health checks passing
- [ ] Load balancer configured
- [ ] Auto-scaling configured

### Phase 3: Deploy Frontend (10 minutes)
- [ ] Frontend built (`npm run build`)
- [ ] Assets uploaded to S3
- [ ] CloudFront distribution configured
- [ ] DNS configured

---

## Verification Checklist

### Infrastructure Verification
- [ ] VPC created with correct CIDR
- [ ] Subnets created in 3 AZs
- [ ] Security groups configured
- [ ] NAT Gateways operational
- [ ] Internet Gateway attached

### Database Verification
- [ ] Aurora cluster created
- [ ] Database accessible from ECS
- [ ] Backup retention configured
- [ ] Encryption enabled

### Application Verification
- [ ] All ECS services running
- [ ] Health checks passing
- [ ] Load balancer healthy
- [ ] API Gateway responding
- [ ] WebSocket connections working

### Monitoring Verification
- [ ] CloudWatch dashboards visible
- [ ] Metrics being collected
- [ ] Alarms configured
- [ ] Logs being aggregated
- [ ] X-Ray traces visible

---

## Testing Checklist

### Smoke Tests
- [ ] Health endpoints responding
- [ ] Database connectivity verified
- [ ] Cache connectivity verified
- [ ] Authentication working
- [ ] Game creation working

### Integration Tests
- [ ] User registration flow
- [ ] OAuth login flow
- [ ] Game play flow
- [ ] Leaderboard updates
- [ ] Support ticket creation

### Performance Tests
- [ ] API latency < 500ms
- [ ] WebSocket latency < 100ms
- [ ] Database queries < 100ms
- [ ] Cache hit rate > 80%

---

## Security Checklist

### Network Security
- [ ] VPC isolation configured
- [ ] Security groups restrictive
- [ ] NACLs configured
- [ ] WAF rules enabled
- [ ] DDoS protection enabled

### Data Security
- [ ] Encryption at rest enabled
- [ ] Encryption in transit enabled
- [ ] KMS keys configured
- [ ] Secrets Manager configured
- [ ] IAM roles least privilege

### Application Security
- [ ] OAuth configured correctly
- [ ] JWT validation working
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Input validation implemented

### Compliance
- [ ] CloudTrail enabled
- [ ] Audit logs configured
- [ ] Backup retention set
- [ ] Data retention policies set

---

## Monitoring & Alerting Checklist

### Metrics
- [ ] Business metrics collecting
- [ ] Technical metrics collecting
- [ ] User experience metrics collecting
- [ ] Custom metrics configured

### Alarms
- [ ] Critical alarms configured
- [ ] Warning alarms configured
- [ ] Composite alarms configured
- [ ] SNS topics configured
- [ ] Email notifications working

### Dashboards
- [ ] System health dashboard
- [ ] Business metrics dashboard
- [ ] Performance dashboard
- [ ] Cost dashboard

---

## Documentation Checklist

### Technical Documentation
- [ ] Architecture diagrams updated
- [ ] API documentation complete
- [ ] Database schema documented
- [ ] Infrastructure documented

### Operational Documentation
- [ ] Runbooks created
- [ ] Troubleshooting guides created
- [ ] Deployment procedures documented
- [ ] Rollback procedures documented

### User Documentation
- [ ] User guides created
- [ ] FAQ updated
- [ ] Support documentation complete

---

## Go-Live Checklist

### Final Verification (1 hour before)
- [ ] All tests passing
- [ ] All services healthy
- [ ] Monitoring working
- [ ] Backups configured
- [ ] Rollback plan ready

### Go-Live (Launch time)
- [ ] DNS switched to production
- [ ] CloudFront cache cleared
- [ ] Monitoring dashboards open
- [ ] Team on standby
- [ ] Communication sent

### Post-Launch (1 hour after)
- [ ] Traffic flowing normally
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] User feedback positive
- [ ] Metrics looking good

---

## Post-Deployment Checklist

### Day 1
- [ ] Monitor all metrics
- [ ] Review all logs
- [ ] Check for errors
- [ ] Verify backups
- [ ] Update documentation

### Week 1
- [ ] Performance optimization
- [ ] Cost optimization
- [ ] Security review
- [ ] User feedback review
- [ ] Bug fixes deployed

### Month 1
- [ ] Capacity planning review
- [ ] Cost analysis
- [ ] Security audit
- [ ] Disaster recovery drill
- [ ] Feature planning

---

## Rollback Checklist

### If Issues Occur
- [ ] Identify issue severity
- [ ] Check monitoring dashboards
- [ ] Review recent changes
- [ ] Decide: fix forward or rollback

### Rollback Procedure
- [ ] Run rollback script
- [ ] Verify previous version deployed
- [ ] Test critical functionality
- [ ] Monitor for stability
- [ ] Communicate status

### Post-Rollback
- [ ] Document issue
- [ ] Create incident report
- [ ] Plan fix
- [ ] Schedule redeployment

---

## Quick Commands Reference

```bash
# Deploy Terraform
./scripts/quick-start-terraform.sh

# Or manual deployment
./scripts/deploy-terraform.sh dev plan
./scripts/deploy-terraform.sh dev apply

# Deploy application
git push origin main

# Run smoke tests
./scripts/smoke-tests.sh

# Check service health
aws ecs describe-services --cluster global-gaming-platform-cluster-dev

# View logs
aws logs tail /aws/ecs/global-gaming-platform/game-engine --follow

# Rollback
./scripts/rollback.sh
```

---

## Support Contacts

- **Tech Lead:** [Name] - [Email]
- **DevOps Lead:** [Name] - [Email]
- **Security Lead:** [Name] - [Email]
- **On-Call:** [PagerDuty]

---

**Last Updated:** November 8, 2025  
**Version:** 1.0.0
