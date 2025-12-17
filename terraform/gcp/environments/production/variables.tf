# ===========================================================================
# Life Navigator - Production Environment Variables
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "lifenav-prod"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
}

# ===========================================================================
# Supabase Configuration (External - Not Managed by Terraform)
# ===========================================================================
# These values come from the Supabase dashboard after project creation
# Store them in GCP Secret Manager using the names defined in main.tf

variable "supabase_project_ref" {
  description = "Supabase project reference (from dashboard)"
  type        = string
  default     = ""  # Set after creating project in Supabase dashboard
}

# ===========================================================================
# Compliance Settings
# ===========================================================================

variable "hipaa_backup_retention_days" {
  description = "Number of days to retain HIPAA database backups (7 years = 2555 days)"
  type        = number
  default     = 2555
}

variable "financial_backup_retention_days" {
  description = "Number of days to retain financial database backups (7 years = 2555 days)"
  type        = number
  default     = 2555
}

# ===========================================================================
# Scaling Configuration
# ===========================================================================

variable "hipaa_db_tier" {
  description = "Machine tier for HIPAA CloudSQL instance"
  type        = string
  default     = "db-custom-2-8192"  # 2 vCPU, 8GB RAM
}

variable "financial_db_tier" {
  description = "Machine tier for Financial CloudSQL instance"
  type        = string
  default     = "db-custom-2-8192"  # 2 vCPU, 8GB RAM
}

variable "redis_memory_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 4
}
