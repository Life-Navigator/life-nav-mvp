# Outputs for Production Environment

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

output "alb_zone_id" {
  description = "Zone ID of the ALB (for Route53 alias records)"
  value       = module.agent_system.alb_zone_id
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

output "redis_reader_endpoint" {
  description = "Redis reader endpoint (for read replicas)"
  value       = module.database.redis_reader_endpoint
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

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = module.agent_system.ecs_task_execution_role_arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = module.agent_system.ecs_task_role_arn
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

output "warning_alerts_topic_arn" {
  description = "ARN of the warning alerts SNS topic"
  value       = module.monitoring.warning_alerts_topic_arn
}

output "system_degraded_alarm_arn" {
  description = "ARN of the system degraded composite alarm"
  value       = module.monitoring.system_degraded_alarm_arn
}

output "performance_degraded_alarm_arn" {
  description = "ARN of the performance degraded composite alarm"
  value       = module.monitoring.performance_degraded_alarm_arn
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
# Security
# ===========================================================================

output "waf_web_acl_arn" {
  description = "ARN of the WAF web ACL (if enabled)"
  value       = var.enable_waf ? aws_wafv2_web_acl.main[0].arn : null
}

# ===========================================================================
# Production Operations Commands
# ===========================================================================

output "operations_commands" {
  description = "Important commands for production operations"
  value = <<-EOT
    ========================================================================
    PRODUCTION OPERATIONS COMMANDS
    ========================================================================

    # View ECS service status
    aws ecs describe-services \
      --cluster ${module.agent_system.ecs_cluster_name} \
      --services ${module.agent_system.ecs_service_name} \
      --region ${var.aws_region}

    # View running tasks
    aws ecs list-tasks \
      --cluster ${module.agent_system.ecs_cluster_name} \
      --service-name ${module.agent_system.ecs_service_name} \
      --region ${var.aws_region}

    # View application logs
    aws logs tail /ecs/production/agent-system --follow --region ${var.aws_region}

    # Get RDS password (use with caution)
    aws secretsmanager get-secret-value \
      --secret-id ${module.database.rds_password_secret_arn} \
      --query SecretString --output text \
      --region ${var.aws_region}

    # Get Redis auth token (use with caution)
    aws secretsmanager get-secret-value \
      --secret-id ${module.database.redis_auth_token_secret_arn} \
      --query SecretString --output text \
      --region ${var.aws_region}

    # Test health endpoint
    curl -v ${module.agent_system.agent_api_health_check_url}

    # View CloudWatch dashboard
    ${module.monitoring.dashboard_url}

    # Scale ECS service manually (if needed)
    aws ecs update-service \
      --cluster ${module.agent_system.ecs_cluster_name} \
      --service ${module.agent_system.ecs_service_name} \
      --desired-count <COUNT> \
      --region ${var.aws_region}

    # Trigger deployment with new task definition
    aws ecs update-service \
      --cluster ${module.agent_system.ecs_cluster_name} \
      --service ${module.agent_system.ecs_service_name} \
      --force-new-deployment \
      --region ${var.aws_region}

    # View RDS performance metrics
    aws rds describe-db-instances \
      --db-instance-identifier ${module.database.rds_instance_id} \
      --region ${var.aws_region}

    # Create RDS snapshot (manual backup)
    aws rds create-db-snapshot \
      --db-instance-identifier ${module.database.rds_instance_id} \
      --db-snapshot-identifier production-manual-$(date +%Y%m%d-%H%M%S) \
      --region ${var.aws_region}

    ========================================================================
    ROUTE53 CONFIGURATION (if using custom domain)
    ========================================================================

    Create an A record (ALIAS) pointing to the ALB:
    - Name: api.yourdomain.com
    - Type: A
    - Alias: Yes
    - Alias Target: ${module.agent_system.alb_dns_name}
    - Alias Hosted Zone ID: ${module.agent_system.alb_zone_id}

    ========================================================================
  EOT
}
