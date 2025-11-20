# ECS Infrastructure Module
# Creates ECS cluster, services, and auto-scaling configuration

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  configuration {
    execute_command_configuration {
      kms_key_id = var.kms_key_arn
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = var.tags
}

# CloudWatch Log Group for ECS Exec
resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/aws/ecs/${var.project_name}/exec"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = var.tags
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = var.fargate_base_capacity
    weight            = var.fargate_weight
    capacity_provider = "FARGATE"
  }

  dynamic "default_capacity_provider_strategy" {
    for_each = var.enable_fargate_spot ? [1] : []
    content {
      base              = var.fargate_spot_base_capacity
      weight            = var.fargate_spot_weight
      capacity_provider = "FARGATE_SPOT"
    }
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection       = var.environment == "production"
  enable_http2                     = true
  enable_cross_zone_load_balancing = true

  # Access logs disabled for initial deployment
  # Enable after creating S3 bucket with proper permissions
  # access_logs {
  #   bucket  = var.alb_access_logs_bucket
  #   prefix  = "${var.project_name}-alb"
  #   enabled = var.enable_alb_access_logs
  # }

  tags = merge(var.tags, {
    Name = "${var.project_name}-alb"
    Type = "load-balancer"
  })
}

# ALB Target Group for Game Engine Service
resource "aws_lb_target_group" "game_engine" {
  name        = "ggp-${var.environment}-game-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200,404"
    path                = "/api/game/status"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 10
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = merge(var.tags, {
    Name    = "${var.project_name}-game-engine-tg"
    Service = "game-engine"
  })
}

# ALB Listener (HTTP)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Service not found"
      status_code  = "404"
    }
  }

  tags = var.tags
}

# ALB Listener (HTTPS)
resource "aws_lb_listener" "https" {
  count             = var.ssl_certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.ssl_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.game_engine.arn
  }

  tags = var.tags
}

# ALB Listener Rule for Game Engine (HTTP)
resource "aws_lb_listener_rule" "game_engine_http" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 15

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.game_engine.arn
  }

  condition {
    path_pattern {
      values = ["/api/game/*"]
    }
  }

  tags = var.tags
}

# ALB Listener Rule for Game Engine (HTTPS)
resource "aws_lb_listener_rule" "game_engine_https" {
  count        = var.ssl_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 15

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.game_engine.arn
  }

  condition {
    path_pattern {
      values = ["/api/game/*"]
    }
  }

  tags = var.tags
}

# ECR Repository for Game Engine
resource "aws_ecr_repository" "game_engine" {
  name                 = "${var.project_name}/game-engine"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = merge(var.tags, {
    Name    = "${var.project_name}-game-engine-ecr"
    Service = "game-engine"
  })
}

# ECR Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "game_engine" {
  repository = aws_ecr_repository.game_engine.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 production images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "release"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last 5 development images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["dev", "staging"]
          countType     = "imageCountMoreThan"
          countNumber   = 5
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "Delete untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ECS Task Definition for Game Engine
resource "aws_ecs_task_definition" "game_engine" {
  family                   = "${var.project_name}-game-engine"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.game_engine_cpu
  memory                   = var.game_engine_memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "game-engine"
      image = "${aws_ecr_repository.game_engine.repository_url}:${var.game_engine_image_tag}"

      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "AWS_REGION"
          value = data.aws_region.current.name
        },
        {
          name  = "SECRET_ARN"
          value = var.jwt_secret_arn
        },
        {
          name  = "DYNAMODB_GAMES_TABLE"
          value = var.dynamodb_games_table
        },
        {
          name  = "DYNAMODB_MOVES_TABLE"
          value = var.dynamodb_moves_table
        },
        {
          name  = "DYNAMODB_LEADERBOARD_TABLE"
          value = var.dynamodb_leaderboard_table
        },
        {
          name  = "DYNAMODB_SESSIONS_TABLE"
          value = var.dynamodb_sessions_table
        },
        {
          name  = "DAX_ENDPOINT"
          value = var.dax_endpoint
        },
        {
          name  = "REDIS_HOST"
          value = var.redis_endpoint
        },
        {
          name  = "REDIS_PORT"
          value = "6379"
        },
        {
          name  = "DB_HOST"
          value = var.database_endpoint
        },
        {
          name  = "DB_PORT"
          value = "5432"
        },
        {
          name  = "DB_NAME"
          value = var.database_name
        },
        {
          name  = "ENABLE_METRICS"
          value = "true"
        },
        {
          name  = "ENABLE_TRACING"
          value = "true"
        }
      ]

      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = "${var.database_secret_arn}:password::"
        },
        {
          name      = "DB_USER"
          valueFrom = "${var.database_secret_arn}:username::"
        },
        {
          name      = "REDIS_PASSWORD"
          valueFrom = var.redis_secret_arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = var.jwt_secret_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.game_engine_log_group
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:3000/health || exit 1"
        ]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60
      }

      linuxParameters = {
        initProcessEnabled = true
      }

      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]
    }
  ])

  tags = merge(var.tags, {
    Name    = "${var.project_name}-game-engine-task"
    Service = "game-engine"
  })
}

# ECS Service for Game Engine
resource "aws_ecs_service" "game_engine" {
  name            = "${var.project_name}-game-engine"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.game_engine.arn
  desired_count   = var.game_engine_desired_count

  # Primary capacity provider (FARGATE)
  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = var.fargate_weight
    base              = var.fargate_base_capacity
  }

  # Optional FARGATE_SPOT capacity provider
  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = var.enable_fargate_spot ? var.fargate_spot_weight : 0
    base              = var.enable_fargate_spot ? var.fargate_spot_base_capacity : 0
  }

  network_configuration {
    security_groups  = [var.ecs_security_group_id]
    subnets          = var.private_subnet_ids
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.game_engine.arn
    container_name   = "game-engine"
    container_port   = 3000
  }

  # deployment_configuration {
  #   maximum_percent         = 200
  #   minimum_healthy_percent = 50
  #
  #   deployment_circuit_breaker {
  #     enable   = true
  #     rollback = true
  #   }
  # }

  enable_execute_command = var.enable_ecs_exec

  # Ensure ALB is created before service
  depends_on = [aws_lb_listener.https, aws_lb_listener.http]

  tags = merge(var.tags, {
    Name    = "${var.project_name}-game-engine-service"
    Service = "game-engine"
  })
}

# Auto Scaling Target
resource "aws_appautoscaling_target" "game_engine" {
  max_capacity       = var.game_engine_max_capacity
  min_capacity       = var.game_engine_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.game_engine.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  tags = var.tags
}

# Auto Scaling Policy - CPU
resource "aws_appautoscaling_policy" "game_engine_cpu" {
  name               = "${var.project_name}-game-engine-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.game_engine.resource_id
  scalable_dimension = aws_appautoscaling_target.game_engine.scalable_dimension
  service_namespace  = aws_appautoscaling_target.game_engine.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.cpu_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# Auto Scaling Policy - Memory
resource "aws_appautoscaling_policy" "game_engine_memory" {
  name               = "${var.project_name}-game-engine-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.game_engine.resource_id
  scalable_dimension = aws_appautoscaling_target.game_engine.scalable_dimension
  service_namespace  = aws_appautoscaling_target.game_engine.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.memory_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# Custom Auto Scaling Policy - WebSocket Connections
resource "aws_appautoscaling_policy" "game_engine_connections" {
  count              = var.enable_connection_based_scaling ? 1 : 0
  name               = "${var.project_name}-game-engine-connections-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.game_engine.resource_id
  scalable_dimension = aws_appautoscaling_target.game_engine.scalable_dimension
  service_namespace  = aws_appautoscaling_target.game_engine.service_namespace

  target_tracking_scaling_policy_configuration {
    customized_metric_specification {
      metric_name = "ActiveConnections"
      namespace   = "${var.project_name}/GameEngine"
      statistic   = "Average"

      dimensions {
        name  = "ServiceName"
        value = aws_ecs_service.game_engine.name
      }
    }
    target_value       = var.connections_target_value
    scale_in_cooldown  = var.scale_in_cooldown
    scale_out_cooldown = var.scale_out_cooldown
  }
}

# CloudWatch Alarms for ECS Service
resource "aws_cloudwatch_metric_alarm" "ecs_service_cpu_high" {
  alarm_name          = "${var.project_name}-ecs-service-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS service CPU utilization"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    ServiceName = aws_ecs_service.game_engine.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_service_memory_high" {
  alarm_name          = "${var.project_name}-ecs-service-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS service memory utilization"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    ServiceName = aws_ecs_service.game_engine.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_target_response_time" {
  alarm_name          = "${var.project_name}-alb-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1.0"
  alarm_description   = "This metric monitors ALB target response time"
  alarm_actions       = [var.warning_sns_topic_arn]
  ok_actions          = [var.info_sns_topic_arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.game_engine.arn_suffix
  }

  tags = var.tags
}