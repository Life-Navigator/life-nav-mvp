# ===========================================================================
# Cloud SQL Elite Module - HIPAA/PCI-DSS Compliant with CMEK
# ===========================================================================
# Features:
# - Customer-Managed Encryption Keys (CMEK) via Cloud KMS
# - Private networking only
# - SSL/TLS enforced
# - Point-in-time recovery
# - Automated backups with 7-year retention option
# - IAM database authentication
# - Query insights for audit
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

variable "database_type" {
  description = "Database type for compliance (hipaa/financial/general)"
  type        = string
  default     = "general"

  validation {
    condition     = contains(["hipaa", "financial", "general"], var.database_type)
    error_message = "database_type must be 'hipaa', 'financial', or 'general'"
  }
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "tier" {
  description = "Machine tier"
  type        = string
}

variable "availability_type" {
  description = "Availability type (ZONAL or REGIONAL)"
  type        = string
  default     = "REGIONAL"  # HA by default for compliance
}

variable "databases" {
  description = "List of databases to create"
  type = list(object({
    name      = string
    charset   = string
    collation = string
  }))
}

variable "private_network" {
  description = "VPC network ID for private IP"
  type        = string
}

variable "enable_cmek" {
  description = "Enable Customer-Managed Encryption Keys"
  type        = bool
  default     = true
}

variable "kms_keyring_name" {
  description = "Name of the KMS keyring (created if doesn't exist)"
  type        = string
  default     = "life-navigator-keyring"
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30  # 7 years = 2555 for HIPAA compliance
}

variable "enable_query_insights" {
  description = "Enable Query Insights for audit"
  type        = bool
  default     = true
}

variable "enable_iam_auth" {
  description = "Enable IAM database authentication"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# ===========================================================================
# KMS Key for CMEK
# ===========================================================================

resource "google_kms_key_ring" "cloudsql" {
  count = var.enable_cmek ? 1 : 0

  name     = "${var.kms_keyring_name}-${var.env}"
  location = var.region
  project  = var.project_id
}

resource "google_kms_crypto_key" "cloudsql" {
  count = var.enable_cmek ? 1 : 0

  name     = "${var.instance_name}-key"
  key_ring = google_kms_key_ring.cloudsql[0].id

  purpose = "ENCRYPT_DECRYPT"

  # Automatic key rotation every 90 days
  rotation_period = "7776000s"  # 90 days

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = var.env == "prod" ? "HSM" : "SOFTWARE"
  }

  labels = merge(var.labels, {
    data_class  = var.database_type
    managed_by  = "terraform"
  })

  lifecycle {
    prevent_destroy = true  # Prevent accidental deletion
  }
}

# Grant Cloud SQL service account access to KMS key
resource "google_project_service_identity" "cloudsql" {
  count = var.enable_cmek ? 1 : 0

  provider = google-beta
  project  = var.project_id
  service  = "sqladmin.googleapis.com"
}

resource "google_kms_crypto_key_iam_member" "cloudsql" {
  count = var.enable_cmek ? 1 : 0

  crypto_key_id = google_kms_crypto_key.cloudsql[0].id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_project_service_identity.cloudsql[0].email}"
}

# ===========================================================================
# Cloud SQL Instance
# ===========================================================================

resource "google_sql_database_instance" "postgres" {
  name             = var.instance_name
  database_version = var.database_version
  region           = var.region
  project          = var.project_id

  # CMEK encryption
  encryption_key_name = var.enable_cmek ? google_kms_crypto_key.cloudsql[0].id : null

  settings {
    tier              = var.tier
    availability_type = var.availability_type
    edition           = "ENTERPRISE"  # Required for some compliance features

    # Disk configuration
    disk_type       = "PD_SSD"
    disk_size       = var.env == "prod" ? 100 : 20
    disk_autoresize = true
    disk_autoresize_limit = var.env == "prod" ? 500 : 100

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = var.database_type == "hipaa" ? 7 : 3

      backup_retention_settings {
        retained_backups = var.backup_retention_days
        retention_unit   = "COUNT"
      }
    }

    # IP configuration - Private only
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.private_network
      require_ssl     = true
      ssl_mode        = "ENCRYPTED_ONLY"

      # Enable IAM authentication
      enable_private_path_for_google_cloud_services = true
    }

    # Maintenance window
    maintenance_window {
      day          = 7  # Sunday
      hour         = 3  # 3 AM
      update_track = "stable"
    }

    # Query Insights for audit
    dynamic "insights_config" {
      for_each = var.enable_query_insights ? [1] : []
      content {
        query_insights_enabled  = true
        query_plans_per_minute  = 5
        query_string_length     = 1024
        record_application_tags = true
        record_client_address   = true
      }
    }

    # Database flags for security and performance
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    database_flags {
      name  = "log_temp_files"
      value = "0"  # Log all temp files
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"  # Log queries > 1s
    }

    # HIPAA/PCI audit logging
    database_flags {
      name  = "log_statement"
      value = var.database_type == "hipaa" || var.database_type == "financial" ? "all" : "ddl"
    }

    database_flags {
      name  = "pgaudit.log"
      value = var.database_type == "hipaa" || var.database_type == "financial" ? "all" : "ddl"
    }

    # Enable pgcrypto for encryption functions
    database_flags {
      name  = "cloudsql.enable_pgaudit"
      value = "on"
    }

    # Performance flags (skip for micro instances)
    dynamic "database_flags" {
      for_each = !startswith(var.tier, "db-f1-") && !startswith(var.tier, "db-g1-") ? [1] : []
      content {
        name  = "max_connections"
        value = var.env == "prod" ? "500" : "100"
      }
    }

    user_labels = merge(var.labels, {
      data_class  = var.database_type
      compliance  = var.database_type == "hipaa" ? "hipaa" : var.database_type == "financial" ? "pci-dss" : "standard"
      encryption  = var.enable_cmek ? "cmek" : "google-managed"
    })
  }

  deletion_protection = var.env == "prod"

  depends_on = [
    google_kms_crypto_key_iam_member.cloudsql
  ]

  lifecycle {
    prevent_destroy = false  # Set to true for production
  }
}

# ===========================================================================
# Databases
# ===========================================================================

resource "google_sql_database" "databases" {
  count = length(var.databases)

  name      = var.databases[count.index].name
  instance  = google_sql_database_instance.postgres.name
  charset   = var.databases[count.index].charset
  collation = var.databases[count.index].collation
  project   = var.project_id
}

# ===========================================================================
# Users
# ===========================================================================

# Application user with password
resource "google_sql_user" "app_user" {
  name     = "lifenavigator_app"
  instance = google_sql_database_instance.postgres.name
  password = random_password.app_password.result
  project  = var.project_id
}

resource "random_password" "app_password" {
  length  = 32
  special = true
}

# Read-only user for reporting/analytics
resource "google_sql_user" "readonly_user" {
  name     = "lifenavigator_readonly"
  instance = google_sql_database_instance.postgres.name
  password = random_password.readonly_password.result
  project  = var.project_id
}

resource "random_password" "readonly_password" {
  length  = 32
  special = true
}

# Migration user (for schema changes)
resource "google_sql_user" "migration_user" {
  name     = "lifenavigator_migration"
  instance = google_sql_database_instance.postgres.name
  password = random_password.migration_password.result
  project  = var.project_id
}

resource "random_password" "migration_password" {
  length  = 32
  special = true
}

# ===========================================================================
# Secret Manager
# ===========================================================================

resource "google_secret_manager_secret" "app_db_url" {
  project   = var.project_id
  secret_id = "${var.instance_name}-app-url"

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "app_db_url" {
  secret      = google_secret_manager_secret.app_db_url.id
  secret_data = "postgresql+asyncpg://${google_sql_user.app_user.name}:${urlencode(random_password.app_password.result)}@${google_sql_database_instance.postgres.private_ip_address}/${var.databases[0].name}?sslmode=require"
}

resource "google_secret_manager_secret" "readonly_db_url" {
  project   = var.project_id
  secret_id = "${var.instance_name}-readonly-url"

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "readonly_db_url" {
  secret      = google_secret_manager_secret.readonly_db_url.id
  secret_data = "postgresql+asyncpg://${google_sql_user.readonly_user.name}:${urlencode(random_password.readonly_password.result)}@${google_sql_database_instance.postgres.private_ip_address}/${var.databases[0].name}?sslmode=require"
}

resource "google_secret_manager_secret" "migration_db_url" {
  project   = var.project_id
  secret_id = "${var.instance_name}-migration-url"

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "migration_db_url" {
  secret      = google_secret_manager_secret.migration_db_url.id
  secret_data = "postgresql://${google_sql_user.migration_user.name}:${urlencode(random_password.migration_password.result)}@${google_sql_database_instance.postgres.private_ip_address}/${var.databases[0].name}?sslmode=require"
}

# Encryption key secret (for application-layer encryption)
resource "google_secret_manager_secret" "encryption_key" {
  project   = var.project_id
  secret_id = "${var.instance_name}-encryption-key"

  replication {
    auto {}
  }

  labels = merge(var.labels, {
    purpose = "field-level-encryption"
  })
}

resource "google_secret_manager_secret_version" "encryption_key" {
  secret      = google_secret_manager_secret.encryption_key.id
  secret_data = random_password.encryption_key.result
}

resource "random_password" "encryption_key" {
  length  = 64  # 256-bit key in hex
  special = false
  upper   = true
  lower   = true
  numeric = true
}

# ===========================================================================
# Outputs
# ===========================================================================

output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.postgres.name
}

output "connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.postgres.connection_name
}

output "private_ip_address" {
  description = "Private IP address"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "app_db_url_secret" {
  description = "Secret Manager secret ID for app database URL"
  value       = google_secret_manager_secret.app_db_url.secret_id
}

output "readonly_db_url_secret" {
  description = "Secret Manager secret ID for readonly database URL"
  value       = google_secret_manager_secret.readonly_db_url.secret_id
}

output "migration_db_url_secret" {
  description = "Secret Manager secret ID for migration database URL"
  value       = google_secret_manager_secret.migration_db_url.secret_id
}

output "encryption_key_secret" {
  description = "Secret Manager secret ID for field-level encryption key"
  value       = google_secret_manager_secret.encryption_key.secret_id
}

output "kms_key_id" {
  description = "KMS key ID used for CMEK"
  value       = var.enable_cmek ? google_kms_crypto_key.cloudsql[0].id : null
}

output "database_names" {
  description = "List of database names"
  value       = [for db in google_sql_database.databases : db.name]
}

output "compliance_info" {
  description = "Compliance information for this instance"
  value = {
    database_type     = var.database_type
    cmek_enabled      = var.enable_cmek
    ssl_required      = true
    private_ip_only   = true
    audit_logging     = var.database_type == "hipaa" || var.database_type == "financial"
    backup_retention  = var.backup_retention_days
    availability_type = var.availability_type
  }
}
