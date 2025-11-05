# Variables for Agent System Module

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where ECS resources will be created"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for ALB"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

# ===========================================================================
# Container Configuration
# ===========================================================================

variable "container_image" {
  description = "Docker image for the agent API (e.g., 123456789.dkr.ecr.us-east-1.amazonaws.com/agent-api:latest)"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 8000
}

variable "task_cpu" {
  description = "CPU units for the task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512 # 0.5 vCPU
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.task_cpu)
    error_message = "Task CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "task_memory" {
  description = "Memory for the task in MB (512, 1024, 2048, 4096, 8192, 16384, 30720)"
  type        = number
  default     = 1024 # 1 GB
  validation {
    condition     = contains([512, 1024, 2048, 4096, 8192, 16384, 30720], var.task_memory)
    error_message = "Task memory must be one of: 512, 1024, 2048, 4096, 8192, 16384, 30720."
  }
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "INFO"
  validation {
    condition     = contains(["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"], var.log_level)
    error_message = "Log level must be one of: DEBUG, INFO, WARNING, ERROR, CRITICAL."
  }
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention period in days"
  type        = number
  default     = 7
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period."
  }
}

# ===========================================================================
# ECS Service Configuration
# ===========================================================================

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
  validation {
    condition     = var.desired_count >= 1 && var.desired_count <= 100
    error_message = "Desired count must be between 1 and 100."
  }
}

variable "min_capacity" {
  description = "Minimum number of tasks for auto-scaling"
  type        = number
  default     = 2
  validation {
    condition     = var.min_capacity >= 1 && var.min_capacity <= 100
    error_message = "Minimum capacity must be between 1 and 100."
  }
}

variable "max_capacity" {
  description = "Maximum number of tasks for auto-scaling"
  type        = number
  default     = 10
  validation {
    condition     = var.max_capacity >= 1 && var.max_capacity <= 100
    error_message = "Maximum capacity must be between 1 and 100."
  }
}

# ===========================================================================
# Auto-scaling Targets
# ===========================================================================

variable "cpu_target_value" {
  description = "Target CPU utilization percentage for auto-scaling"
  type        = number
  default     = 70
  validation {
    condition     = var.cpu_target_value >= 10 && var.cpu_target_value <= 100
    error_message = "CPU target value must be between 10 and 100."
  }
}

variable "memory_target_value" {
  description = "Target memory utilization percentage for auto-scaling"
  type        = number
  default     = 80
  validation {
    condition     = var.memory_target_value >= 10 && var.memory_target_value <= 100
    error_message = "Memory target value must be between 10 and 100."
  }
}

variable "request_count_target" {
  description = "Target request count per task for auto-scaling"
  type        = number
  default     = 1000
  validation {
    condition     = var.request_count_target >= 1
    error_message = "Request count target must be at least 1."
  }
}

# ===========================================================================
# Fargate Capacity Providers
# ===========================================================================

variable "fargate_base_capacity" {
  description = "Base number of tasks to run on regular Fargate"
  type        = number
  default     = 1
}

variable "fargate_weight" {
  description = "Weight for regular Fargate capacity provider"
  type        = number
  default     = 1
}

variable "fargate_spot_weight" {
  description = "Weight for Fargate Spot capacity provider (0 to disable)"
  type        = number
  default     = 0 # Disabled by default for production stability
  validation {
    condition     = var.fargate_spot_weight >= 0
    error_message = "Fargate Spot weight must be non-negative."
  }
}

# ===========================================================================
# Load Balancer Configuration
# ===========================================================================

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (optional, uses HTTP if not provided)"
  type        = string
  default     = null
}

variable "alb_logs_bucket" {
  description = "S3 bucket for ALB access logs (optional)"
  type        = string
  default     = null
}

variable "enable_alb_logs" {
  description = "Enable ALB access logs"
  type        = bool
  default     = false
}

# ===========================================================================
# Database Configuration
# ===========================================================================

variable "database_config" {
  description = "Database configuration from database module"
  type = object({
    postgres_host                = string
    postgres_port                = number
    postgres_database            = string
    postgres_username            = string
    postgres_password_secret_arn = string
    redis_host                   = string
    redis_port                   = number
    redis_auth_token_secret_arn  = string
  })
}

variable "rds_password_secret_arn" {
  description = "ARN of Secrets Manager secret for RDS password"
  type        = string
}

variable "redis_auth_token_secret_arn" {
  description = "ARN of Secrets Manager secret for Redis auth token"
  type        = string
}

# ===========================================================================
# Application Dependencies
# ===========================================================================

variable "vllm_endpoint" {
  description = "vLLM inference endpoint URL"
  type        = string
  default     = ""
}

variable "mcp_server_url" {
  description = "MCP server URL (e.g., https://app.example.com/mcp)"
  type        = string
  default     = ""
}

variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs the task needs access to"
  type        = list(string)
  default     = []
}

# ===========================================================================
# Feature Flags
# ===========================================================================

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights"
  type        = bool
  default     = false # Can be expensive, enable for production
}

variable "enable_service_discovery" {
  description = "Enable AWS Cloud Map service discovery"
  type        = bool
  default     = false
}

# ===========================================================================
# Tagging
# ===========================================================================

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
