# Variables for Backend Configuration

variable "aws_region" {
  description = "AWS region for backend resources"
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  type        = string
  default     = "life-navigator-terraform-state"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.state_bucket_name))
    error_message = "Bucket name must be lowercase alphanumeric with hyphens."
  }
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table for state locking"
  type        = string
  default     = "life-navigator-terraform-locks"
}

variable "create_alb_logs_bucket" {
  description = "Create S3 bucket for ALB access logs"
  type        = bool
  default     = true
}

variable "alb_logs_bucket_name" {
  description = "Name of the S3 bucket for ALB access logs"
  type        = string
  default     = "life-navigator-alb-logs"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.alb_logs_bucket_name))
    error_message = "Bucket name must be lowercase alphanumeric with hyphens."
  }
}
