# Development Environment Configuration
# Cost-optimized setup for development and testing

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Backend configuration (uncomment after creating S3 bucket)
  # backend "s3" {
  #   bucket         = "life-navigator-terraform-state"
  #   key            = "dev/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "life-navigator-terraform-locks"
  #   encrypt        = true
  # }
}

# ===========================================================================
# Provider Configuration
# ===========================================================================

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "dev"
      Project     = "Life Navigator Agent System"
      ManagedBy   = "Terraform"
      CostCenter  = "Engineering"
    }
  }
}

# ===========================================================================
# Local Variables
# ===========================================================================

locals {
  environment = "dev"

  common_tags = {
    Environment = local.environment
    Project     = "Life Navigator"
    ManagedBy   = "Terraform"
  }
}

# ===========================================================================
# Networking Module
# ===========================================================================

module "networking" {
  source = "../../modules/networking"

  environment = local.environment
  aws_region  = var.aws_region

  vpc_cidr           = "10.0.0.0/16"
  az_count           = 2 # Cost optimization: only 2 AZs for dev
  enable_nat_gateway = true
  enable_flow_logs   = false # Disabled to save costs in dev

  tags = local.common_tags
}

# ===========================================================================
# Database Module
# ===========================================================================

module "database" {
  source = "../../modules/database"

  environment         = local.environment
  vpc_id              = module.networking.vpc_id
  private_subnet_ids  = module.networking.private_subnet_ids
  ecs_security_group_id = module.agent_system.ecs_security_group_id

  # RDS Configuration (cost-optimized)
  postgres_version          = "16.1"
  db_instance_class         = "db.t4g.micro" # 2 vCPU, 1 GB RAM
  db_allocated_storage      = 20
  db_name                   = "graphrag_dev"
  db_username               = "graphrag_admin"
  enable_multi_az           = false # Single-AZ for dev
  backup_retention_period   = 1     # Minimal backups
  enable_enhanced_monitoring = false
  enable_performance_insights = false

  # Redis Configuration (cost-optimized)
  redis_version                  = "7.1"
  redis_node_type                = "cache.t4g.micro" # 2 vCPU, 0.5 GB RAM
  redis_num_cache_nodes          = 1                 # Single node for dev
  redis_snapshot_retention_limit = 1

  # Monitoring
  sns_topic_arn = module.monitoring.warning_alerts_topic_arn

  tags = local.common_tags

  depends_on = [module.networking, module.agent_system]
}

# ===========================================================================
# Agent System Module
# ===========================================================================

module "agent_system" {
  source = "../../modules/agent-system"

  environment = local.environment
  aws_region  = var.aws_region

  vpc_id              = module.networking.vpc_id
  public_subnet_ids   = module.networking.public_subnet_ids
  private_subnet_ids  = module.networking.private_subnet_ids

  # Container Configuration
  container_image = var.container_image
  container_port  = 8000
  task_cpu        = 512  # 0.5 vCPU
  task_memory     = 1024 # 1 GB RAM
  log_level       = "DEBUG" # Verbose logging for dev
  log_retention_days = 3

  # ECS Service Configuration (minimal for dev)
  desired_count = 1
  min_capacity  = 1
  max_capacity  = 3

  # Auto-scaling Targets
  cpu_target_value      = 70
  memory_target_value   = 80
  request_count_target  = 1000

  # Fargate Configuration (no Spot for stability in dev)
  fargate_base_capacity = 1
  fargate_weight        = 1
  fargate_spot_weight   = 0

  # Load Balancer (HTTP only for dev)
  certificate_arn   = null # No HTTPS in dev
  enable_alb_logs   = false

  # Database Configuration
  database_config = module.database.database_config
  rds_password_secret_arn = module.database.rds_password_secret_arn
  redis_auth_token_secret_arn = module.database.redis_auth_token_secret_arn

  # Application Dependencies
  vllm_endpoint  = var.vllm_endpoint
  mcp_server_url = var.mcp_server_url
  s3_bucket_arns = []

  # Feature Flags
  enable_container_insights = false
  enable_service_discovery  = false

  tags = local.common_tags

  depends_on = [module.networking]
}

# ===========================================================================
# Monitoring Module
# ===========================================================================

module "monitoring" {
  source = "../../modules/monitoring"

  environment = local.environment
  aws_region  = var.aws_region

  # Resource References
  ecs_cluster_name            = module.agent_system.ecs_cluster_name
  ecs_service_name            = module.agent_system.ecs_service_name
  alb_arn_suffix              = module.agent_system.alb_arn_suffix
  target_group_arn_suffix     = module.agent_system.target_group_arn_suffix
  cloudwatch_log_group_name   = module.agent_system.cloudwatch_log_group_name
  rds_instance_id             = module.database.rds_instance_id
  redis_replication_group_id  = module.database.redis_replication_group_id

  # Alarm Thresholds
  min_task_count                  = 1
  request_count_spike_threshold   = 5000

  # SNS Configuration (dev team emails)
  critical_alert_emails = var.alert_emails
  warning_alert_emails  = var.alert_emails

  tags = local.common_tags

  depends_on = [module.agent_system, module.database]
}
