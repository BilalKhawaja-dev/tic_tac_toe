# ECS Module Outputs

# ECS Cluster
output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

# Load Balancer
output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

output "alb_security_group_id" {
  description = "Security group ID of the Application Load Balancer"
  value       = var.alb_security_group_id
}

# Target Groups
output "game_engine_target_group_arn" {
  description = "ARN of the game engine target group"
  value       = aws_lb_target_group.game_engine.arn
}

output "game_engine_target_group_name" {
  description = "Name of the game engine target group"
  value       = aws_lb_target_group.game_engine.name
}

# ECR Repository
output "game_engine_ecr_repository_url" {
  description = "URL of the game engine ECR repository"
  value       = aws_ecr_repository.game_engine.repository_url
}

output "game_engine_ecr_repository_arn" {
  description = "ARN of the game engine ECR repository"
  value       = aws_ecr_repository.game_engine.arn
}

output "game_engine_ecr_repository_name" {
  description = "Name of the game engine ECR repository"
  value       = aws_ecr_repository.game_engine.name
}

# ECS Service
output "game_engine_service_id" {
  description = "ID of the game engine ECS service"
  value       = aws_ecs_service.game_engine.id
}

output "game_engine_service_name" {
  description = "Name of the game engine ECS service"
  value       = aws_ecs_service.game_engine.name
}

output "game_engine_service_arn" {
  description = "ARN of the game engine ECS service"
  value       = aws_ecs_service.game_engine.id
}

# Task Definition
output "game_engine_task_definition_arn" {
  description = "ARN of the game engine task definition"
  value       = aws_ecs_task_definition.game_engine.arn
}

output "game_engine_task_definition_family" {
  description = "Family of the game engine task definition"
  value       = aws_ecs_task_definition.game_engine.family
}

output "game_engine_task_definition_revision" {
  description = "Revision of the game engine task definition"
  value       = aws_ecs_task_definition.game_engine.revision
}

# Auto Scaling
output "game_engine_autoscaling_target_resource_id" {
  description = "Resource ID of the game engine auto scaling target"
  value       = aws_appautoscaling_target.game_engine.resource_id
}

output "game_engine_cpu_scaling_policy_arn" {
  description = "ARN of the CPU-based auto scaling policy"
  value       = aws_appautoscaling_policy.game_engine_cpu.arn
}

output "game_engine_memory_scaling_policy_arn" {
  description = "ARN of the memory-based auto scaling policy"
  value       = aws_appautoscaling_policy.game_engine_memory.arn
}

output "game_engine_connections_scaling_policy_arn" {
  description = "ARN of the connections-based auto scaling policy"
  value       = var.enable_connection_based_scaling ? aws_appautoscaling_policy.game_engine_connections[0].arn : null
}

# CloudWatch Alarms
output "ecs_cpu_alarm_arn" {
  description = "ARN of the ECS CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.ecs_service_cpu_high.arn
}

output "ecs_memory_alarm_arn" {
  description = "ARN of the ECS memory utilization alarm"
  value       = aws_cloudwatch_metric_alarm.ecs_service_memory_high.arn
}

output "alb_response_time_alarm_arn" {
  description = "ARN of the ALB response time alarm"
  value       = aws_cloudwatch_metric_alarm.alb_target_response_time.arn
}

# Service Discovery
output "service_discovery_namespace" {
  description = "Service discovery namespace for ECS services"
  value       = "${var.project_name}.local"
}

output "game_engine_service_discovery_name" {
  description = "Service discovery name for game engine service"
  value       = "game-engine.${var.project_name}.local"
}

# Deployment Information
output "deployment_info" {
  description = "Deployment information for the ECS services"
  value = {
    cluster_name        = aws_ecs_cluster.main.name
    service_name        = aws_ecs_service.game_engine.name
    task_definition_arn = aws_ecs_task_definition.game_engine.arn
    ecr_repository_url  = aws_ecr_repository.game_engine.repository_url
    alb_dns_name        = aws_lb.main.dns_name
    target_group_arn    = aws_lb_target_group.game_engine.arn
  }
}

# Health Check Endpoints
output "health_check_endpoints" {
  description = "Health check endpoints for monitoring"
  value = {
    alb_health_check = "http://${aws_lb.main.dns_name}/health"
    target_group_health_check = {
      path                = "/health"
      port                = 3000
      protocol            = "HTTP"
      healthy_threshold   = 2
      unhealthy_threshold = 3
      timeout             = 10
      interval            = 30
    }
  }
}

# Scaling Configuration
output "scaling_configuration" {
  description = "Auto scaling configuration details"
  value = {
    min_capacity             = var.game_engine_min_capacity
    max_capacity             = var.game_engine_max_capacity
    desired_count            = var.game_engine_desired_count
    cpu_target_value         = var.cpu_target_value
    memory_target_value      = var.memory_target_value
    connections_target_value = var.connections_target_value
    scale_in_cooldown        = var.scale_in_cooldown
    scale_out_cooldown       = var.scale_out_cooldown
  }
}

# Resource Configuration
output "resource_configuration" {
  description = "ECS task resource configuration"
  value = {
    cpu                      = var.game_engine_cpu
    memory                   = var.game_engine_memory
    network_mode             = "awsvpc"
    requires_compatibilities = ["FARGATE"]
  }
}

# Alias outputs for compatibility
output "cluster_name" {
  description = "Alias for ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecr_repository_url" {
  description = "Alias for ECR repository URL"
  value       = aws_ecr_repository.game_engine.repository_url
}
