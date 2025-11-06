# ===========================================================================
# Cloud SQL Module - PostgreSQL database
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "env" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "instance_name" {
  description = "Cloud SQL instance name"
  type        = string
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "tier" {
  description = "Machine tier (e.g., db-custom-2-7680)"
  type        = string
}

variable "availability_type" {
  description = "Availability type (ZONAL or REGIONAL)"
  type        = string
  default     = "ZONAL"
}

variable "enable_schedule" {
  description = "Enable scheduled start/stop"
  type        = bool
  default     = false
}

variable "schedule_start" {
  description = "Cron schedule for start (e.g., '0 7 * * 1-5')"
  type        = string
  default     = ""
}

variable "schedule_end" {
  description = "Cron schedule for stop (e.g., '0 19 * * 1-5')"
  type        = string
  default     = ""
}

variable "databases" {
  description = "List of databases to create"
  type = list(object({
    name      = string
    charset   = string
    collation = string
  }))
}

variable "backup_configuration" {
  description = "Backup configuration"
  type = object({
    enabled                        = bool
    start_time                     = string
    point_in_time_recovery_enabled = bool
    transaction_log_retention_days = number
  })
}

variable "private_network" {
  description = "VPC network ID for private IP"
  type        = string
}

variable "require_ssl" {
  description = "Require SSL connections"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

variable "enable_pgvector" {
  description = "Enable pgvector extension for vector similarity search"
  type        = bool
  default     = true
}

# Cloud SQL Instance
resource "google_sql_database_instance" "postgres" {
  name             = var.instance_name
  database_version = var.database_version
  region           = var.region
  project          = var.project_id

  settings {
    tier              = var.tier
    availability_type = var.availability_type

    # Disk configuration
    disk_type       = "PD_SSD"
    disk_size       = 100
    disk_autoresize = true

    # Backup configuration
    backup_configuration {
      enabled                        = var.backup_configuration.enabled
      start_time                     = var.backup_configuration.start_time
      point_in_time_recovery_enabled = var.backup_configuration.point_in_time_recovery_enabled
      transaction_log_retention_days = var.backup_configuration.transaction_log_retention_days
      backup_retention_settings {
        retained_backups = var.env == "prod" ? 30 : 7
        retention_unit   = "COUNT"
      }
    }

    # IP configuration
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.private_network
      require_ssl     = var.require_ssl
    }

    # Maintenance window
    maintenance_window {
      day          = 7  # Sunday
      hour         = 3  # 3 AM
      update_track = "stable"
    }

    # Database flags
    database_flags {
      name  = "max_connections"
      value = var.env == "prod" ? "500" : "100"
    }

    database_flags {
      name  = "shared_buffers"
      value = var.env == "prod" ? "2097152" : "524288"  # 8GB for prod, 2GB for dev
    }

    database_flags {
      name  = "work_mem"
      value = "32768"  # 128MB
    }

    database_flags {
      name  = "effective_cache_size"
      value = var.env == "prod" ? "6291456" : "1572864"  # 24GB for prod, 6GB for dev
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"  # Log queries > 1s
    }

    # pgvector optimization flags
    dynamic "database_flags" {
      for_each = var.enable_pgvector ? [1] : []
      content {
        name  = "maintenance_work_mem"
        value = "2097152"  # 8GB for vector index building
      }
    }

    dynamic "database_flags" {
      for_each = var.enable_pgvector ? [1] : []
      content {
        name  = "max_parallel_workers"
        value = "8"
      }
    }

    dynamic "database_flags" {
      for_each = var.enable_pgvector ? [1] : []
      content {
        name  = "max_parallel_workers_per_gather"
        value = "4"
      }
    }

    user_labels = var.labels
  }

  deletion_protection = var.env == "prod" ? true : false

  depends_on = [var.private_network]
}

# Databases
resource "google_sql_database" "databases" {
  count = length(var.databases)

  name      = var.databases[count.index].name
  instance  = google_sql_database_instance.postgres.name
  charset   = var.databases[count.index].charset
  collation = var.databases[count.index].collation
  project   = var.project_id
}

# Default user
resource "google_sql_user" "default" {
  name     = "lifenavigator"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
  project  = var.project_id
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Cloud Scheduler jobs for start/stop (dev/staging only)
resource "google_cloud_scheduler_job" "start_db" {
  count = var.enable_schedule ? 1 : 0

  name             = "${var.instance_name}-start"
  description      = "Start Cloud SQL instance"
  schedule         = var.schedule_start
  time_zone        = "America/New_York"
  attempt_deadline = "320s"
  project          = var.project_id
  region           = var.region

  http_target {
    http_method = "PATCH"
    uri         = "https://sqladmin.googleapis.com/v1/projects/${var.project_id}/instances/${var.instance_name}"

    body = base64encode(jsonencode({
      settings = {
        activationPolicy = "ALWAYS"
      }
    }))

    oauth_token {
      service_account_email = google_service_account.scheduler_sa[0].email
    }
  }
}

resource "google_cloud_scheduler_job" "stop_db" {
  count = var.enable_schedule ? 1 : 0

  name             = "${var.instance_name}-stop"
  description      = "Stop Cloud SQL instance"
  schedule         = var.schedule_end
  time_zone        = "America/New_York"
  attempt_deadline = "320s"
  project          = var.project_id
  region           = var.region

  http_target {
    http_method = "PATCH"
    uri         = "https://sqladmin.googleapis.com/v1/projects/${var.project_id}/instances/${var.instance_name}"

    body = base64encode(jsonencode({
      settings = {
        activationPolicy = "NEVER"
      }
    }))

    oauth_token {
      service_account_email = google_service_account.scheduler_sa[0].email
    }
  }
}

# Service account for scheduler
resource "google_service_account" "scheduler_sa" {
  count = var.enable_schedule ? 1 : 0

  account_id   = "${var.instance_name}-scheduler"
  display_name = "Cloud SQL Scheduler"
  project      = var.project_id
}

resource "google_project_iam_member" "scheduler_sql_admin" {
  count = var.enable_schedule ? 1 : 0

  project = var.project_id
  role    = "roles/cloudsql.admin"
  member  = "serviceAccount:${google_service_account.scheduler_sa[0].email}"
}

# Outputs
output "connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.postgres.connection_name
}

output "private_ip_address" {
  description = "Private IP address"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "instance_name" {
  description = "Instance name"
  value       = google_sql_database_instance.postgres.name
}

output "database_password" {
  description = "Database password"
  value       = random_password.db_password.result
  sensitive   = true
}

output "database_user" {
  description = "Database user"
  value       = google_sql_user.default.name
}

output "pgvector_enabled" {
  description = "Whether pgvector optimization is enabled"
  value       = var.enable_pgvector
}

output "pgvector_init_sql" {
  description = "SQL commands to initialize pgvector extension (run after first connection)"
  value       = var.enable_pgvector ? "CREATE EXTENSION IF NOT EXISTS vector;\nCREATE EXTENSION IF NOT EXISTS pg_trgm;\nCREATE EXTENSION IF NOT EXISTS btree_gin;" : "pgvector not enabled"
}
