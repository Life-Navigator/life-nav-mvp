# Outputs for Agent System Module

# ===========================================================================
# ECS Cluster Outputs
# ===========================================================================

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

# ===========================================================================
# ECS Service Outputs
# ===========================================================================

output "ecs_service_id" {
  description = "ID of the ECS service"
  value       = aws_ecs_service.agent_api.id
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.agent_api.name
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = aws_ecs_task_definition.agent_api.arn
}

output "ecs_task_definition_family" {
  description = "Family of the ECS task definition"
  value       = aws_ecs_task_definition.agent_api.family
}

output "ecs_task_definition_revision" {
  description = "Revision of the ECS task definition"
  value       = aws_ecs_task_definition.agent_api.revision
}

# ===========================================================================
# Load Balancer Outputs
# ===========================================================================

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer (for Route53)"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_arn_suffix" {
  description = "ARN suffix of the ALB (for CloudWatch metrics)"
  value       = aws_lb.main.arn_suffix
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.agent_api.arn
}

output "target_group_arn_suffix" {
  description = "ARN suffix of the target group (for CloudWatch metrics)"
  value       = aws_lb_target_group.agent_api.arn_suffix
}

# ===========================================================================
# Security Group Outputs
# ===========================================================================

output "alb_security_group_id" {
  description = "Security group ID for the ALB"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  value       = aws_security_group.ecs_tasks.id
}

# ===========================================================================
# IAM Role Outputs
# ===========================================================================

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

# ===========================================================================
# CloudWatch Outputs
# ===========================================================================

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.agent_system.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.agent_system.arn
}

# ===========================================================================
# Auto-scaling Outputs
# ===========================================================================

output "autoscaling_target_resource_id" {
  description = "Resource ID of the auto-scaling target"
  value       = aws_appautoscaling_target.ecs_target.resource_id
}

output "autoscaling_cpu_policy_arn" {
  description = "ARN of the CPU-based auto-scaling policy"
  value       = aws_appautoscaling_policy.ecs_cpu.arn
}

output "autoscaling_memory_policy_arn" {
  description = "ARN of the memory-based auto-scaling policy"
  value       = aws_appautoscaling_policy.ecs_memory.arn
}

output "autoscaling_requests_policy_arn" {
  description = "ARN of the request count-based auto-scaling policy"
  value       = aws_appautoscaling_policy.ecs_requests.arn
}

# ===========================================================================
# Service Discovery Outputs
# ===========================================================================

output "service_discovery_namespace_id" {
  description = "ID of the service discovery namespace (if enabled)"
  value       = var.enable_service_discovery ? aws_service_discovery_private_dns_namespace.main[0].id : null
}

output "service_discovery_service_arn" {
  description = "ARN of the service discovery service (if enabled)"
  value       = var.enable_service_discovery ? aws_service_discovery_service.agent_api[0].arn : null
}

# ===========================================================================
# URL Outputs
# ===========================================================================

output "agent_api_url" {
  description = "Full URL to access the agent API"
  value       = var.certificate_arn != null ? "https://${aws_lb.main.dns_name}" : "http://${aws_lb.main.dns_name}"
}

output "agent_api_health_check_url" {
  description = "Health check endpoint URL"
  value       = var.certificate_arn != null ? "https://${aws_lb.main.dns_name}/health" : "http://${aws_lb.main.dns_name}/health"
}
