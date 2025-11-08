# CI/CD Pipeline Module

This Terraform module creates a complete CI/CD pipeline infrastructure using AWS CodePipeline, CodeBuild, and CodeDeploy for automated application deployments.

## Features

- **Multi-Service Support**: Creates separate pipelines for each microservice
- **Docker Image Building**: Automated Docker image creation and ECR push
- **Blue-Green Deployments**: ECS blue-green deployment strategy with CodeDeploy
- **Automated Testing**: Runs tests during build phase
- **Security Scanning**: ECR image scanning on push
- **Artifact Management**: S3 bucket for pipeline artifacts with encryption
- **Event-Driven Triggers**: Automatic pipeline execution on code changes
- **Image Lifecycle**: Automated cleanup of old Docker images

## Architecture

```
CodeCommit → CloudWatch Event → CodePipeline
                                      ↓
                                  CodeBuild (Build & Test)
                                      ↓
                                    ECR (Store Images)
                                      ↓
                                  CodeDeploy (Blue-Green Deploy)
                                      ↓
                                    ECS Fargate
```

## Resources Created

### Per Service:
- ECR Repository with lifecycle policies
- CodeBuild Project for building Docker images
- CodePipeline with Source, Build, and Deploy stages
- CloudWatch Event Rule for automatic triggers

### Shared:
- S3 Bucket for pipeline artifacts (encrypted)
- IAM Roles for CodePipeline, CodeBuild, and CloudWatch Events
- CloudWatch Log Groups for build logs

## Usage

```hcl
module "cicd" {
  source = "./modules/cicd"

  project_name    = "gaming-platform"
  environment     = "production"
  aws_region      = "eu-west-2"
  aws_account_id  = "123456789012"
  
  services = [
    "game-engine",
    "auth-service",
    "leaderboard-service",
    "frontend"
  ]

  repository_name = "gaming-platform-repo"
  repository_arn  = "arn:aws:codecommit:eu-west-2:123456789012:gaming-platform-repo"
  branch_name     = "main"
  kms_key_id      = "arn:aws:kms:eu-west-2:123456789012:key/..."

  enable_approval_stage = true
  notification_emails   = ["devops@example.com"]

  common_tags = {
    Project     = "Gaming Platform"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}
```

## Pipeline Stages

### 1. Source Stage
- Monitors CodeCommit repository for changes
- Triggers on commits to specified branch
- Downloads source code as artifact

### 2. Build Stage
- Runs CodeBuild project
- Executes buildspec.yml commands:
  - Logs into ECR
  - Builds Docker image
  - Runs tests inside container
  - Pushes image to ECR
  - Creates deployment artifacts

### 3. Deploy Stage
- Uses CodeDeploy for ECS blue-green deployment
- Creates new task definition with new image
- Gradually shifts traffic from blue to green
- Automatic rollback on deployment failure

## Build Specification

The module expects a `buildspec.yml` file in the repository root with the following structure:

```yaml
version: 0.2
phases:
  pre_build:
    commands:
      - echo "Logging in to ECR..."
      - aws ecr get-login-password | docker login ...
  build:
    commands:
      - echo "Building Docker image..."
      - docker build -t $REPOSITORY_URI:$IMAGE_TAG .
      - docker run --rm $REPOSITORY_URI:$IMAGE_TAG npm test
  post_build:
    commands:
      - docker push $REPOSITORY_URI:$IMAGE_TAG
      - printf '[{"name":"%s","imageUri":"%s"}]' $SERVICE_NAME $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json
artifacts:
  files:
    - imagedefinitions.json
    - appspec.yml
```

## Environment Variables

The following environment variables are automatically set in CodeBuild:

- `AWS_DEFAULT_REGION`: AWS region
- `AWS_ACCOUNT_ID`: AWS account ID
- `IMAGE_REPO_NAME`: ECR repository name
- `SERVICE_NAME`: Name of the service being built
- `ENVIRONMENT`: Environment name (dev/staging/prod)

## ECR Lifecycle Policies

Automatically configured for each repository:
- Keep last 10 tagged images (with `v` prefix)
- Remove untagged images after 7 days

## Security Features

- **Encryption**: S3 artifacts encrypted with KMS
- **Image Scanning**: ECR scans images on push
- **IAM Roles**: Least privilege access for all services
- **Private Access**: S3 bucket blocks all public access
- **Secure Logging**: CloudWatch logs for audit trail

## Monitoring

### CloudWatch Logs
- Build logs: `/aws/codebuild/{project-name}-{service}`
- Pipeline execution history in CodePipeline console

### Metrics
- Pipeline success/failure rates
- Build duration
- Deployment frequency
- Image scan findings

## Troubleshooting

### Build Failures
1. Check CodeBuild logs in CloudWatch
2. Verify Docker image builds locally
3. Ensure tests pass in container
4. Check ECR permissions

### Deployment Failures
1. Review CodeDeploy deployment logs
2. Check ECS task definition
3. Verify container health checks
4. Review application logs

### Permission Issues
1. Verify IAM role policies
2. Check KMS key permissions
3. Ensure ECR repository policies allow push

## Cost Optimization

- **Build Caching**: Enabled for Docker layers and source
- **Compute Size**: Uses SMALL instances (adjust if needed)
- **Image Cleanup**: Lifecycle policies reduce storage costs
- **Log Retention**: Configure CloudWatch log retention

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| project_name | Name of the project | string | - | yes |
| environment | Environment name | string | - | yes |
| aws_region | AWS region | string | - | yes |
| aws_account_id | AWS account ID | string | - | yes |
| services | List of services | list(string) | [...] | no |
| repository_name | CodeCommit repository name | string | - | yes |
| repository_arn | CodeCommit repository ARN | string | - | yes |
| branch_name | Branch to trigger pipeline | string | "main" | no |
| kms_key_id | KMS key for encryption | string | - | yes |
| enable_approval_stage | Enable manual approval | bool | false | no |
| notification_emails | Email addresses for notifications | list(string) | [] | no |

## Outputs

| Name | Description |
|------|-------------|
| pipeline_artifacts_bucket | S3 bucket for artifacts |
| ecr_repositories | Map of ECR repository URLs |
| codebuild_projects | Map of CodeBuild project names |
| codepipeline_names | Map of CodePipeline names |
| codepipeline_arns | Map of CodePipeline ARNs |
| codebuild_role_arn | IAM role ARN for CodeBuild |
| codepipeline_role_arn | IAM role ARN for CodePipeline |

## Best Practices

1. **Separate Pipelines**: One pipeline per service for independent deployments
2. **Branch Strategy**: Use feature branches and merge to main for deployments
3. **Testing**: Always run tests in build phase before deployment
4. **Rollback**: Configure automatic rollback on CloudWatch alarms
5. **Notifications**: Set up SNS topics for pipeline status updates
6. **Approval Gates**: Enable manual approval for production deployments
7. **Tagging**: Use consistent tags for cost allocation and management

## Integration with Other Modules

This module integrates with:
- **ECS Module**: Deploys to ECS services
- **Network Module**: Uses VPC and subnets
- **Security Module**: Uses KMS keys and IAM roles
- **Monitoring Module**: Sends metrics to CloudWatch

## Future Enhancements

- [ ] Add canary deployment support
- [ ] Integrate with AWS X-Ray for tracing
- [ ] Add automated security scanning (Snyk, OWASP ZAP)
- [ ] Implement deployment approval workflows
- [ ] Add Slack/Teams notifications
- [ ] Support for Lambda deployments
- [ ] Multi-region deployment orchestration
