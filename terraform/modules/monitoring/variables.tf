# Variables for Monitoring Module

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

# ===========================================================================
# Resource References
# ===========================================================================

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster to monitor"
  type        = string
}

variable "ecs_service_name" {
  description = "Name of the ECS service to monitor"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ARN suffix of the Application Load Balancer"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "ARN suffix of the ALB target group"
  type        = string
}

variable "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for the application"
  type        = string
}

variable "rds_instance_id" {
  description = "ID of the RDS instance to monitor"
  type        = string
}

variable "redis_replication_group_id" {
  description = "ID of the Redis replication group to monitor"
  type        = string
}

# ===========================================================================
# Alarm Thresholds
# ===========================================================================

variable "min_task_count" {
  description = "Minimum acceptable number of running ECS tasks"
  type        = number
  default     = 2
  validation {
    condition     = var.min_task_count >= 1
    error_message = "Minimum task count must be at least 1."
  }
}

variable "request_count_spike_threshold" {
  description = "Request count threshold for traffic spike detection"
  type        = number
  default     = 10000
  validation {
    condition     = var.request_count_spike_threshold > 0
    error_message = "Request count spike threshold must be positive."
  }
}

# ===========================================================================
# SNS Configuration
# ===========================================================================

variable "critical_alert_emails" {
  description = "List of email addresses for critical alerts (P0/P1)"
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for email in var.critical_alert_emails : can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", email))])
    error_message = "All email addresses must be valid."
  }
}

variable "warning_alert_emails" {
  description = "List of email addresses for warning alerts (P2)"
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for email in var.warning_alert_emails : can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", email))])
    error_message = "All email addresses must be valid."
  }
}

variable "kms_key_id" {
  description = "KMS key ID for encrypting SNS topics (optional)"
  type        = string
  default     = null
}

# ===========================================================================
# Tagging
# ===========================================================================

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
