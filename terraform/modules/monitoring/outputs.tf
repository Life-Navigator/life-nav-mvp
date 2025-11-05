# Outputs for Monitoring Module

# ===========================================================================
# SNS Topic Outputs
# ===========================================================================

output "critical_alerts_topic_arn" {
  description = "ARN of the critical alerts SNS topic"
  value       = aws_sns_topic.critical_alerts.arn
}

output "warning_alerts_topic_arn" {
  description = "ARN of the warning alerts SNS topic"
  value       = aws_sns_topic.warning_alerts.arn
}

output "info_alerts_topic_arn" {
  description = "ARN of the info alerts SNS topic"
  value       = aws_sns_topic.info_alerts.arn
}

# ===========================================================================
# CloudWatch Dashboard Outputs
# ===========================================================================

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_arn" {
  description = "ARN of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_arn
}

output "dashboard_url" {
  description = "URL to access the CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

# ===========================================================================
# Alarm ARNs (for reference in other modules)
# ===========================================================================

output "ecs_running_tasks_alarm_arn" {
  description = "ARN of ECS running tasks low alarm"
  value       = aws_cloudwatch_metric_alarm.ecs_running_tasks_low.arn
}

output "ecs_cpu_alarm_arn" {
  description = "ARN of ECS CPU high alarm"
  value       = aws_cloudwatch_metric_alarm.ecs_cpu_high.arn
}

output "ecs_memory_alarm_arn" {
  description = "ARN of ECS memory high alarm"
  value       = aws_cloudwatch_metric_alarm.ecs_memory_high.arn
}

output "alb_unhealthy_targets_alarm_arn" {
  description = "ARN of ALB unhealthy targets alarm"
  value       = aws_cloudwatch_metric_alarm.alb_unhealthy_targets.arn
}

output "alb_5xx_errors_alarm_arn" {
  description = "ARN of ALB 5XX errors alarm"
  value       = aws_cloudwatch_metric_alarm.alb_5xx_errors.arn
}

output "alb_response_time_alarm_arn" {
  description = "ARN of ALB response time alarm"
  value       = aws_cloudwatch_metric_alarm.alb_response_time.arn
}

output "error_log_rate_alarm_arn" {
  description = "ARN of error log rate alarm"
  value       = aws_cloudwatch_metric_alarm.error_log_rate.arn
}

output "critical_logs_alarm_arn" {
  description = "ARN of critical logs alarm"
  value       = aws_cloudwatch_metric_alarm.critical_logs.arn
}

output "task_failure_rate_alarm_arn" {
  description = "ARN of task failure rate alarm"
  value       = aws_cloudwatch_metric_alarm.task_failure_rate.arn
}

# ===========================================================================
# Composite Alarm ARNs
# ===========================================================================

output "system_degraded_alarm_arn" {
  description = "ARN of system degraded composite alarm"
  value       = aws_cloudwatch_composite_alarm.system_degraded.arn
}

output "performance_degraded_alarm_arn" {
  description = "ARN of performance degraded composite alarm"
  value       = aws_cloudwatch_composite_alarm.performance_degraded.arn
}

# ===========================================================================
# Log Metric Filter Names
# ===========================================================================

output "error_logs_filter_name" {
  description = "Name of the error logs metric filter"
  value       = aws_cloudwatch_log_metric_filter.error_logs.name
}

output "critical_logs_filter_name" {
  description = "Name of the critical logs metric filter"
  value       = aws_cloudwatch_log_metric_filter.critical_logs.name
}

output "task_failures_filter_name" {
  description = "Name of the task failures metric filter"
  value       = aws_cloudwatch_log_metric_filter.task_failures.name
}
