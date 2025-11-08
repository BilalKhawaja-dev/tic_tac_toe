# CI/CD Pipeline Module Outputs

output "pipeline_artifacts_bucket" {
  description = "S3 bucket for pipeline artifacts"
  value       = aws_s3_bucket.pipeline_artifacts.id
}

output "ecr_repositories" {
  description = "Map of ECR repository names to URLs"
  value = {
    for k, v in aws_ecr_repository.services : k => v.repository_url
  }
}

output "codebuild_projects" {
  description = "Map of CodeBuild project names"
  value = {
    for k, v in aws_codebuild_project.services : k => v.name
  }
}

output "codepipeline_names" {
  description = "Map of CodePipeline names"
  value = {
    for k, v in aws_codepipeline.services : k => v.name
  }
}

output "codepipeline_arns" {
  description = "Map of CodePipeline ARNs"
  value = {
    for k, v in aws_codepipeline.services : k => v.arn
  }
}

output "codebuild_role_arn" {
  description = "IAM role ARN for CodeBuild"
  value       = aws_iam_role.codebuild.arn
}

output "codepipeline_role_arn" {
  description = "IAM role ARN for CodePipeline"
  value       = aws_iam_role.codepipeline.arn
}
