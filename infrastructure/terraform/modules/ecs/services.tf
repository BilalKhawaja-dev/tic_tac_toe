# Additional ECS Services - Auth, Leaderboard, Frontend

# ============================================================================
# AUTH SERVICE
# ============================================================================

# ECR Repository for Auth Service
# Note: Repository already exists, managed outside Terraform
# Use data source instead
data "aws_ecr_repository" "auth_service" {
  name = "${var.project_name}/auth-service"
}

# ALB Target Group for Auth Service
resource "aws_lb_target_group" "auth_service" {
  name        = "ggp-${var.environment}-auth-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 10
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = merge(var.tags, {
    Name    = "${var.project_name}-auth-service-tg"
    Service = "auth-service"
  })
}

# ALB Listener Rule for Auth Service (HTTP)
resource "aws_lb_listener_rule" "auth_service_http" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_service.arn
  }

  condition {
    path_pattern {
      values = ["/api/auth/*", "/api/user/*"]
    }
  }

  tags = var.tags
}

# ALB Listener Rule for Auth Service (HTTPS)
resource "aws_lb_listener_rule" "auth_service_https" {
  count        = var.ssl_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_service.arn
  }

  condition {
    path_pattern {
      values = ["/api/auth/*", "/api/user/*"]
    }
  }

  tags = var.tags
}

# ECS Task Definition for Auth Service
resource "aws_ecs_task_definition" "auth_service" {
  family                   = "${var.project_name}-auth-service"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.auth_service_cpu
  memory                   = var.auth_service_memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "auth-service"
      image = "${data.aws_ecr_repository.auth_service.repository_url}:${var.auth_service_image_tag}"

      essential = true

      portMappings = [
        {
          containerPort = 3001
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
          value = "3001"
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
          name  = "COGNITO_USER_POOL_ID"
          value = var.cognito_user_pool_id
        },
        {
          name  = "COGNITO_CLIENT_ID"
          value = var.cognito_client_id
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
          name  = "REDIS_HOST"
          value = var.redis_endpoint
        },
        {
          name  = "REDIS_PORT"
          value = "6379"
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
          name      = "JWT_SECRET"
          valueFrom = var.jwt_secret_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.auth_service_log_group
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:3001/health || exit 1"
        ]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = merge(var.tags, {
    Name    = "${var.project_name}-auth-service-task"
    Service = "auth-service"
  })
}

# ECS Service for Auth Service
resource "aws_ecs_service" "auth_service" {
  name            = "${var.project_name}-auth-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.auth_service.arn
  desired_count   = var.auth_service_desired_count

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 100
    base              = 1
  }

  network_configuration {
    security_groups  = [var.ecs_security_group_id]
    subnets          = var.private_subnet_ids
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.auth_service.arn
    container_name   = "auth-service"
    container_port   = 3001
  }

  enable_execute_command = var.enable_ecs_exec

  depends_on = [aws_lb_listener.http]

  tags = merge(var.tags, {
    Name    = "${var.project_name}-auth-service"
    Service = "auth-service"
  })
}

# ============================================================================
# LEADERBOARD SERVICE
# ============================================================================

# ECR Repository for Leaderboard Service
resource "aws_ecr_repository" "leaderboard_service" {
  name                 = "${var.project_name}/leaderboard-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = merge(var.tags, {
    Name    = "${var.project_name}-leaderboard-service-ecr"
    Service = "leaderboard-service"
  })
}

# ALB Target Group for Leaderboard Service
resource "aws_lb_target_group" "leaderboard_service" {
  name        = "ggp-${var.environment}-leaderboard-tg"
  port        = 3002
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 10
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = merge(var.tags, {
    Name    = "${var.project_name}-leaderboard-service-tg"
    Service = "leaderboard-service"
  })
}

# ALB Listener Rule for Leaderboard Service (HTTP)
resource "aws_lb_listener_rule" "leaderboard_service_http" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.leaderboard_service.arn
  }

  condition {
    path_pattern {
      values = ["/api/leaderboard/*"]
    }
  }

  tags = var.tags
}

# ALB Listener Rule for Leaderboard Service (HTTPS)
resource "aws_lb_listener_rule" "leaderboard_service_https" {
  count        = var.ssl_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.leaderboard_service.arn
  }

  condition {
    path_pattern {
      values = ["/api/leaderboard/*"]
    }
  }

  tags = var.tags
}

# ECS Task Definition for Leaderboard Service
resource "aws_ecs_task_definition" "leaderboard_service" {
  family                   = "${var.project_name}-leaderboard-service"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.leaderboard_service_cpu
  memory                   = var.leaderboard_service_memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "leaderboard-service"
      image = "${aws_ecr_repository.leaderboard_service.repository_url}:${var.leaderboard_service_image_tag}"

      essential = true

      portMappings = [
        {
          containerPort = 3002
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
          value = "3002"
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
          name  = "DYNAMODB_LEADERBOARD_TABLE"
          value = var.dynamodb_leaderboard_table
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
          name  = "REDIS_HOST"
          value = var.redis_endpoint
        },
        {
          name  = "REDIS_PORT"
          value = "6379"
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
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.leaderboard_service_log_group
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "node -e \"require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""
        ]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = merge(var.tags, {
    Name    = "${var.project_name}-leaderboard-service-task"
    Service = "leaderboard-service"
  })
}

# ECS Service for Leaderboard Service
resource "aws_ecs_service" "leaderboard_service" {
  name            = "${var.project_name}-leaderboard-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.leaderboard_service.arn
  desired_count   = var.leaderboard_service_desired_count

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 100
    base              = 1
  }

  network_configuration {
    security_groups  = [var.ecs_security_group_id]
    subnets          = var.private_subnet_ids
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.leaderboard_service.arn
    container_name   = "leaderboard-service"
    container_port   = 3002
  }

  enable_execute_command = var.enable_ecs_exec

  depends_on = [aws_lb_listener.http]

  tags = merge(var.tags, {
    Name    = "${var.project_name}-leaderboard-service"
    Service = "leaderboard-service"
  })
}

# ============================================================================
# FRONTEND
# ============================================================================

# ECR Repository for Frontend
resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}/frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = merge(var.tags, {
    Name    = "${var.project_name}-frontend-ecr"
    Service = "frontend"
  })
}

# ALB Target Group for Frontend
resource "aws_lb_target_group" "frontend" {
  name        = "ggp-${var.environment}-frontend-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 10
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = merge(var.tags, {
    Name    = "${var.project_name}-frontend-tg"
    Service = "frontend"
  })
}

# ALB Listener Rule for Frontend (HTTP) - Catch all other paths
resource "aws_lb_listener_rule" "frontend_http" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  tags = var.tags
}

# ALB Listener Rule for Frontend (HTTPS)
resource "aws_lb_listener_rule" "frontend_https" {
  count        = var.ssl_certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  tags = var.tags
}

# ECS Task Definition for Frontend
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name  = "frontend"
      image = "${aws_ecr_repository.frontend.repository_url}:${var.frontend_image_tag}"

      essential = true

      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "API_BASE_URL"
          value = "http://${aws_lb.main.dns_name}"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.frontend_log_group
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1"
        ]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = merge(var.tags, {
    Name    = "${var.project_name}-frontend-task"
    Service = "frontend"
  })
}

# ECS Service for Frontend
resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.frontend_desired_count

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 100
    base              = 1
  }

  network_configuration {
    security_groups  = [var.ecs_security_group_id]
    subnets          = var.private_subnet_ids
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 8080
  }

  enable_execute_command = var.enable_ecs_exec

  depends_on = [aws_lb_listener.http]

  tags = merge(var.tags, {
    Name    = "${var.project_name}-frontend"
    Service = "frontend"
  })
}
