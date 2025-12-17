# ===========================================================================
# Cloudflare Production Variables
# ===========================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "lifenavigator.app"
}

variable "gke_ingress_ip" {
  description = "GKE Ingress static IP"
  type        = string
}

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = "lifenav-prod"
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "supabase_url" {
  description = "Supabase URL"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key"
  type        = string
  sensitive   = true
}

variable "alert_email" {
  description = "Email for alerts"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  default     = ""
}

variable "gcs_log_bucket" {
  description = "GCS bucket for Cloudflare logs"
  type        = string
  default     = "life-navigator-cloudflare-logs-prod"
}

variable "admin_allowed_ips" {
  description = "IP addresses allowed for admin access"
  type        = list(string)
  default     = []
}
