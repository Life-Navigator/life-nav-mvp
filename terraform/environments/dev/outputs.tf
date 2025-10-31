# Outputs for Development Environment

# ===========================================================================
# Application URLs
# ===========================================================================

output "agent_api_url" {
  description = "URL to access the agent API"
  value       = module.agent_system.agent_api_url
}

output "agent_api_health_check_url" {
  description = "Health check endpoint URL"
  value       = module.agent_system.agent_api_health_check_url
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.agent_system.alb_dns_name
}

# ===========================================================================
# Database Connection Information
# ===========================================================================

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.database.rds_endpoint
  sensitive   = true
}

output "rds_db_name" {
  description = "Name of the RDS database"
  value       = module.database.rds_db_name
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.database.redis_endpoint
  sensitive   = true
}

# ===========================================================================
# Secrets Manager ARNs
# ===========================================================================

output "rds_password_secret_arn" {
  description = "ARN of RDS password secret"
  value       = module.database.rds_password_secret_arn
}

output "redis_auth_token_secret_arn" {
  description = "ARN of Redis auth token secret"
  value       = module.database.redis_auth_token_secret_arn
}

# ===========================================================================
# ECS Information
# ===========================================================================

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.agent_system.ecs_cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.agent_system.ecs_service_name
}

output "ecs_task_definition_family" {
  description = "Family of the ECS task definition"
  value       = module.agent_system.ecs_task_definition_family
}

# ===========================================================================
# Monitoring
# ===========================================================================

output "dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = module.monitoring.dashboard_url
}

output "critical_alerts_topic_arn" {
  description = "ARN of the critical alerts SNS topic"
  value       = module.monitoring.critical_alerts_topic_arn
}

# ===========================================================================
# Networking
# ===========================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "availability_zones" {
  description = "Availability zones used"
  value       = module.networking.availability_zones
}

# ===========================================================================
# Quick Start Commands
# ===========================================================================

output "quick_start_commands" {
  description = "Useful commands for working with the dev environment"
  value = <<-EOT
    # View ECS service status
    aws ecs describe-services --cluster ${module.agent_system.ecs_cluster_name} --services ${module.agent_system.ecs_service_name} --region ${var.aws_region}

    # View logs
    aws logs tail /ecs/dev/agent-system --follow --region ${var.aws_region}

    # Get RDS password
    aws secretsmanager get-secret-value --secret-id ${module.database.rds_password_secret_arn} --query SecretString --output text --region ${var.aws_region}

    # Get Redis auth token
    aws secretsmanager get-secret-value --secret-id ${module.database.redis_auth_token_secret_arn} --query SecretString --output text --region ${var.aws_region}

    # Test health endpoint
    curl ${module.agent_system.agent_api_health_check_url}

    # View CloudWatch dashboard
    open ${module.monitoring.dashboard_url}
  EOT
}
