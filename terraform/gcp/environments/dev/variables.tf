# ===========================================================================
# Variables for Development Environment
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
}
