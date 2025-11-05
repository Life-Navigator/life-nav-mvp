# Variables for Production Environment

variable "aws_region" {
  description = "AWS region for production environment"
  type        = string
  default     = "us-east-1"
}

variable "container_image" {
  description = "Docker image for the agent API"
  type        = string
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS"
  type        = string
}

variable "alb_logs_bucket" {
  description = "S3 bucket for ALB access logs"
  type        = string
}

variable "vllm_endpoint" {
  description = "vLLM inference endpoint URL"
  type        = string
}

variable "mcp_server_url" {
  description = "MCP server URL (production)"
  type        = string
}

variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs the task needs access to"
  type        = list(string)
  default     = []
}

variable "critical_alert_emails" {
  description = "Email addresses for critical alerts (on-call)"
  type        = list(string)
}

variable "warning_alert_emails" {
  description = "Email addresses for warning alerts (team)"
  type        = list(string)
}

variable "kms_key_id" {
  description = "KMS key ID for encrypting SNS topics"
  type        = string
  default     = null
}

variable "enable_waf" {
  description = "Enable AWS WAF for the ALB"
  type        = bool
  default     = true
}
