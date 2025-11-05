# Production Environment Configuration
# High-availability, production-grade setup with enhanced monitoring

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
  #   key            = "production/terraform.tfstate"
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
      Environment = "production"
      Project     = "Life Navigator Agent System"
      ManagedBy   = "Terraform"
      CostCenter  = "Production"
      Compliance  = "Required"
    }
  }
}

# ===========================================================================
# Local Variables
# ===========================================================================

locals {
  environment = "production"

  common_tags = {
    Environment = local.environment
    Project     = "Life Navigator"
    ManagedBy   = "Terraform"
    Compliance  = "HIPAA-Ready"
  }
}

# ===========================================================================
# Networking Module
# ===========================================================================

module "networking" {
  source = "../../modules/networking"

  environment = local.environment
  aws_region  = var.aws_region

  vpc_cidr           = "10.1.0.0/16"
  az_count           = 3 # Full HA across 3 AZs
  enable_nat_gateway = true
  enable_flow_logs   = true # Enabled for security compliance
  flow_logs_retention_days = 30

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

  # RDS Configuration (production-grade)
  postgres_version          = "16.1"
  db_instance_class         = "db.r6g.large" # 2 vCPU, 16 GB RAM
  db_allocated_storage      = 100
  db_name                   = "graphrag_prod"
  db_username               = "graphrag_admin"
  enable_multi_az           = true # Multi-AZ for HA
  backup_retention_period   = 30   # 30 days of backups
  enable_enhanced_monitoring = true
  enable_performance_insights = true

  # Redis Configuration (production-grade)
  redis_version                  = "7.1"
  redis_node_type                = "cache.r6g.large" # 2 vCPU, 13.07 GB RAM
  redis_num_cache_nodes          = 3                 # Multi-AZ cluster
  redis_snapshot_retention_limit = 7

  # Monitoring
  sns_topic_arn = module.monitoring.critical_alerts_topic_arn

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
  task_cpu        = 2048 # 2 vCPU
  task_memory     = 4096 # 4 GB RAM
  log_level       = "INFO"
  log_retention_days = 30

  # ECS Service Configuration (production scale)
  desired_count = 4
  min_capacity  = 4
  max_capacity  = 20

  # Auto-scaling Targets
  cpu_target_value      = 60 # More aggressive scaling
  memory_target_value   = 70
  request_count_target  = 2000

  # Fargate Configuration (Spot disabled for production stability)
  fargate_base_capacity = 4
  fargate_weight        = 1
  fargate_spot_weight   = 0 # No Spot in production

  # Load Balancer (HTTPS enabled)
  certificate_arn   = var.certificate_arn
  alb_logs_bucket   = var.alb_logs_bucket
  enable_alb_logs   = true

  # Database Configuration
  database_config = module.database.database_config
  rds_password_secret_arn = module.database.rds_password_secret_arn
  redis_auth_token_secret_arn = module.database.redis_auth_token_secret_arn

  # Application Dependencies
  vllm_endpoint  = var.vllm_endpoint
  mcp_server_url = var.mcp_server_url
  s3_bucket_arns = var.s3_bucket_arns

  # Feature Flags
  enable_container_insights = true # Enabled for production observability
  enable_service_discovery  = true

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
  min_task_count                  = 4
  request_count_spike_threshold   = 20000

  # SNS Configuration (separate on-call and team distribution lists)
  critical_alert_emails = var.critical_alert_emails
  warning_alert_emails  = var.warning_alert_emails

  # KMS encryption for SNS (production security)
  kms_key_id = var.kms_key_id

  tags = local.common_tags

  depends_on = [module.agent_system, module.database]
}

# ===========================================================================
# Additional Production Resources
# ===========================================================================

# WAF for ALB (optional but recommended for production)
resource "aws_wafv2_web_acl" "main" {
  count = var.enable_waf ? 1 : 0

  name  = "${local.environment}-agent-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.environment}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.environment}-aws-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.environment}-aws-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.environment}-waf"
    sampled_requests_enabled   = true
  }

  tags = local.common_tags
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "main" {
  count = var.enable_waf ? 1 : 0

  resource_arn = module.agent_system.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.main[0].arn
}
