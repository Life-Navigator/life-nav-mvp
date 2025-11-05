# Variables for Development Environment

variable "aws_region" {
  description = "AWS region for development environment"
  type        = string
  default     = "us-east-1"
}

variable "container_image" {
  description = "Docker image for the agent API"
  type        = string
  default     = "123456789.dkr.ecr.us-east-1.amazonaws.com/agent-api:latest"
}

variable "vllm_endpoint" {
  description = "vLLM inference endpoint URL"
  type        = string
  default     = ""
}

variable "mcp_server_url" {
  description = "MCP server URL (development)"
  type        = string
  default     = ""
}

variable "alert_emails" {
  description = "Email addresses for alerts in dev environment"
  type        = list(string)
  default     = []
}
