# Agent System Module - ECS Fargate, ALB, Auto-scaling
# Production-ready container orchestration with load balancing

# ===========================================================================
# ECS Cluster
# ===========================================================================

resource "aws_ecs_cluster" "main" {
  name = "${var.environment}-agent-cluster"

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-agent-cluster"
    }
  )
}

# ECS Cluster Capacity Providers (Fargate)
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = var.fargate_base_capacity
    weight            = var.fargate_weight
    capacity_provider = "FARGATE"
  }

  default_capacity_provider_strategy {
    weight            = var.fargate_spot_weight
    capacity_provider = "FARGATE_SPOT"
  }
}

# ===========================================================================
# Application Load Balancer (ALB)
# ===========================================================================

# ALB Security Group
resource "aws_security_group" "alb" {
  name_prefix = "${var.environment}-alb-"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from anywhere (redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-alb-sg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.environment}-agent-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "production" ? true : false
  enable_http2              = true
  enable_cross_zone_load_balancing = true

  access_logs {
    bucket  = var.alb_logs_bucket
    prefix  = "${var.environment}-alb"
    enabled = var.enable_alb_logs
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-agent-alb"
    }
  )
}

# Target Group for Agent API
resource "aws_lb_target_group" "agent_api" {
  name_prefix = "${substr(var.environment, 0, 3)}-api-"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # Required for Fargate

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-agent-api-tg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  count = var.certificate_arn != null ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.agent_api.arn
  }

  tags = var.tags
}

# HTTP Listener (redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = var.certificate_arn != null ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = var.certificate_arn != null ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    target_group_arn = var.certificate_arn == null ? aws_lb_target_group.agent_api.arn : null
  }

  tags = var.tags
}

# ===========================================================================
# ECS Task Definition
# ===========================================================================

# ECS Task Execution Role (for pulling images, writing logs)
resource "aws_iam_role" "ecs_task_execution" {
  name_prefix = "${var.environment}-ecs-task-execution-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy for Secrets Manager access
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name_prefix = "${var.environment}-ecs-secrets-"
  role        = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          var.rds_password_secret_arn,
          var.redis_auth_token_secret_arn
        ]
      }
    ]
  })
}

# ECS Task Role (for application permissions)
resource "aws_iam_role" "ecs_task" {
  name_prefix = "${var.environment}-ecs-task-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Task role policy for AWS service access
resource "aws_iam_role_policy" "ecs_task_policy" {
  name_prefix = "${var.environment}-ecs-task-"
  role        = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.agent_system.arn}:*"
      },
      # S3 access (for vector storage, if needed)
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = var.s3_bucket_arns
      },
      # Bedrock access (for LLM inference fallback)
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "agent_system" {
  name              = "/ecs/${var.environment}/agent-system"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# ECS Task Definition
resource "aws_ecs_task_definition" "agent_api" {
  family                   = "${var.environment}-agent-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "agent-api"
      image     = var.container_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "LOG_LEVEL"
          value = var.log_level
        },
        {
          name  = "POSTGRES_HOST"
          value = var.database_config.postgres_host
        },
        {
          name  = "POSTGRES_PORT"
          value = tostring(var.database_config.postgres_port)
        },
        {
          name  = "POSTGRES_DATABASE"
          value = var.database_config.postgres_database
        },
        {
          name  = "POSTGRES_USERNAME"
          value = var.database_config.postgres_username
        },
        {
          name  = "REDIS_HOST"
          value = var.database_config.redis_host
        },
        {
          name  = "REDIS_PORT"
          value = tostring(var.database_config.redis_port)
        },
        {
          name  = "VLLM_ENDPOINT"
          value = var.vllm_endpoint
        },
        {
          name  = "MCP_SERVER_URL"
          value = var.mcp_server_url
        }
      ]

      secrets = [
        {
          name      = "POSTGRES_PASSWORD"
          valueFrom = var.database_config.postgres_password_secret_arn
        },
        {
          name      = "REDIS_AUTH_TOKEN"
          valueFrom = var.database_config.redis_auth_token_secret_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.agent_system.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "agent-api"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:${var.container_port}/health || exit 1"
        ]
        interval = 30
        timeout  = 5
        retries  = 3
      }
    }
  ])

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-agent-api"
    }
  )
}

# ===========================================================================
# ECS Service
# ===========================================================================

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.environment}-ecs-tasks-"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Traffic from ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-ecs-tasks-sg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# ECS Service
resource "aws_ecs_service" "agent_api" {
  name            = "${var.environment}-agent-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.agent_api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  platform_version = "LATEST"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.agent_api.arn
    container_name   = "agent-api"
    container_port   = var.container_port
  }

  # Graceful deployments
  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # Service discovery (optional)
  dynamic "service_registries" {
    for_each = var.enable_service_discovery ? [1] : []
    content {
      registry_arn = aws_service_discovery_service.agent_api[0].arn
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-agent-api-service"
    }
  )

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy.ecs_task_policy
  ]
}

# ===========================================================================
# Auto-scaling
# ===========================================================================

# Auto-scaling Target
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.agent_api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto-scaling Policy - CPU
resource "aws_appautoscaling_policy" "ecs_cpu" {
  name               = "${var.environment}-agent-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Auto-scaling Policy - Memory
resource "aws_appautoscaling_policy" "ecs_memory" {
  name               = "${var.environment}-agent-api-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.memory_target_value
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

# Auto-scaling Policy - Request Count
resource "aws_appautoscaling_policy" "ecs_requests" {
  name               = "${var.environment}-agent-api-request-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.request_count_target
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.agent_api.arn_suffix}"
    }
  }
}

# ===========================================================================
# Service Discovery (Optional)
# ===========================================================================

resource "aws_service_discovery_private_dns_namespace" "main" {
  count = var.enable_service_discovery ? 1 : 0

  name        = "${var.environment}.local"
  description = "Private DNS namespace for ${var.environment}"
  vpc         = var.vpc_id

  tags = var.tags
}

resource "aws_service_discovery_service" "agent_api" {
  count = var.enable_service_discovery ? 1 : 0

  name = "agent-api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main[0].id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = var.tags
}
