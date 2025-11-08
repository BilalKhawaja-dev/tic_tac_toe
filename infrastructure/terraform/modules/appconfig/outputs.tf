# Outputs for AppConfig Module

output "application_id" {
  description = "The ID of the AppConfig application"
  value       = aws_appconfig_application.gaming_platform.id
}

output "application_arn" {
  description = "The ARN of the AppConfig application"
  value       = aws_appconfig_application.gaming_platform.arn
}

output "environment_ids" {
  description = "Map of environment names to their IDs"
  value = {
    for env_name, env in aws_appconfig_environment.environments : env_name => env.environment_id
  }
}

output "feature_flags_profile_id" {
  description = "The ID of the feature flags configuration profile"
  value       = aws_appconfig_configuration_profile.feature_flags.configuration_profile_id
}

output "app_settings_profile_id" {
  description = "The ID of the application settings configuration profile"
  value       = aws_appconfig_configuration_profile.app_settings.configuration_profile_id
}

output "deployment_strategy_ids" {
  description = "Map of deployment strategy names to their IDs"
  value = {
    gradual   = aws_appconfig_deployment_strategy.gradual_rollout.id
    immediate = aws_appconfig_deployment_strategy.immediate_rollout.id
  }
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for configuration alerts"
  value       = aws_sns_topic.config_alerts.arn
}