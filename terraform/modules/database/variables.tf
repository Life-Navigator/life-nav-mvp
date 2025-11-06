# Variables for Database Module

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where database resources will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for database deployment"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID of ECS tasks that need database access"
  type        = string
}

# ===========================================================================
# RDS PostgreSQL Configuration
# ===========================================================================

variable "postgres_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.1"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro" # 2 vCPU, 1 GB RAM - good for dev/staging
  validation {
    condition     = can(regex("^db\\.", var.db_instance_class))
    error_message = "Instance class must be a valid RDS instance type (e.g., db.t4g.micro, db.r6g.large)."
  }
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
  validation {
    condition     = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 65536
    error_message = "Allocated storage must be between 20 GB and 65536 GB."
  }
}

variable "db_name" {
  description = "Name of the default database"
  type        = string
  default     = "graphrag"
}

variable "db_username" {
  description = "Master username for the database"
  type        = string
  default     = "graphrag_admin"
}

variable "enable_multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = false # Set to true for production
}

variable "backup_retention_period" {
  description = "Number of days to retain automated backups (RDS automated backups max: 35 days. For HIPAA 7-year retention, use AWS Backup service configured separately)"
  type        = number
  default     = 35 # Maximum for RDS automated backups
  validation {
    condition     = var.backup_retention_period >= 0 && var.backup_retention_period <= 35
    error_message = "RDS automated backup retention period must be between 0 and 35 days. For longer retention (e.g., HIPAA 7 years), use AWS Backup service."
  }
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring for RDS"
  type        = bool
  default     = false # Set to true for production
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights for RDS"
  type        = bool
  default     = false # Set to true for production
}

# ===========================================================================
# ElastiCache Redis Configuration
# ===========================================================================

variable "redis_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.1"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro" # 2 vCPU, 0.5 GB RAM - good for dev/staging
  validation {
    condition     = can(regex("^cache\\.", var.redis_node_type))
    error_message = "Node type must be a valid ElastiCache node type (e.g., cache.t4g.micro, cache.r6g.large)."
  }
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes (>1 enables Multi-AZ)"
  type        = number
  default     = 1 # Set to 2+ for production HA
  validation {
    condition     = var.redis_num_cache_nodes >= 1 && var.redis_num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 1 and 6."
  }
}

variable "redis_snapshot_retention_limit" {
  description = "Number of days to retain Redis snapshots"
  type        = number
  default     = 5
  validation {
    condition     = var.redis_snapshot_retention_limit >= 0 && var.redis_snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

# ===========================================================================
# Monitoring Configuration
# ===========================================================================

variable "sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms (optional)"
  type        = string
  default     = null
}

# ===========================================================================
# HIPAA Backup Configuration
# ===========================================================================

variable "backup_kms_key_arn" {
  description = "KMS key ARN for encrypting AWS Backup vault (required for HIPAA compliance in production)"
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
