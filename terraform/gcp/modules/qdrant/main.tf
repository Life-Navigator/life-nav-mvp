# ===========================================================================
# Qdrant Vector Database Module - Cloud Run Deployment
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

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "qdrant"
}

variable "qdrant_version" {
  description = "Qdrant version"
  type        = string
  default     = "v1.7.4"
}

variable "cpu" {
  description = "CPU allocation (1000m = 1 CPU)"
  type        = string
  default     = "2000m"
}

variable "memory" {
  description = "Memory allocation (e.g., 2Gi)"
  type        = string
  default     = "4Gi"
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 3
}

variable "storage_size_gb" {
  description = "Persistent storage size in GB"
  type        = number
  default     = 50
}

variable "enable_api_key" {
  description = "Enable API key authentication"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

variable "vpc_connector_id" {
  description = "VPC connector ID for private networking"
  type        = string
  default     = null
}

# API key for Qdrant
resource "random_password" "qdrant_api_key" {
  count = var.enable_api_key ? 1 : 0

  length  = 48
  special = false
}

# Store API key in Secret Manager
resource "google_secret_manager_secret" "qdrant_api_key" {
  count = var.enable_api_key ? 1 : 0

  secret_id = "qdrant-api-key-${var.env}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "qdrant_api_key" {
  count = var.enable_api_key ? 1 : 0

  secret      = google_secret_manager_secret.qdrant_api_key[0].id
  secret_data = random_password.qdrant_api_key[0].result
}

# GCS bucket for Qdrant snapshots/backups
resource "google_storage_bucket" "qdrant_backups" {
  name          = "${var.project_id}-qdrant-backups-${var.env}"
  location      = var.region
  project       = var.project_id
  force_destroy = var.env != "prod"

  uniform_bucket_level_access = true

  versioning {
    enabled = var.env == "prod"
  }

  lifecycle_rule {
    condition {
      age = var.env == "prod" ? 90 : 30
    }
    action {
      type = "Delete"
    }
  }

  labels = var.labels
}

# Service account for Cloud Run
resource "google_service_account" "qdrant" {
  account_id   = "qdrant-${var.env}"
  display_name = "Qdrant Vector DB (${var.env})"
  project      = var.project_id
}

# Grant Cloud Run SA access to GCS bucket
resource "google_storage_bucket_iam_member" "qdrant_bucket_admin" {
  bucket = google_storage_bucket.qdrant_backups.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.qdrant.email}"
}

# Grant Secret Manager access
resource "google_secret_manager_secret_iam_member" "qdrant_api_key_access" {
  count = var.enable_api_key ? 1 : 0

  secret_id = google_secret_manager_secret.qdrant_api_key[0].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.qdrant.email}"
  project   = var.project_id
}

# Cloud Run Service for Qdrant
resource "google_cloud_run_v2_service" "qdrant" {
  name     = "${var.service_name}-${var.env}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.qdrant.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    # VPC Access (if connector provided)
    dynamic "vpc_access" {
      for_each = var.vpc_connector_id != null ? [1] : []
      content {
        connector = var.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }
    }

    containers {
      image = "qdrant/qdrant:${var.qdrant_version}"

      ports {
        name           = "http1"
        container_port = 6333
      }

      # Environment variables
      env {
        name  = "QDRANT__SERVICE__HTTP_PORT"
        value = "6333"
      }

      env {
        name  = "QDRANT__SERVICE__GRPC_PORT"
        value = "6334"
      }

      dynamic "env" {
        for_each = var.enable_api_key ? [1] : []
        content {
          name = "QDRANT__SERVICE__API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.qdrant_api_key[0].secret_id
              version = "latest"
            }
          }
        }
      }

      env {
        name  = "QDRANT__STORAGE__SNAPSHOTS_PATH"
        value = "/qdrant/snapshots"
      }

      env {
        name  = "QDRANT__LOG_LEVEL"
        value = var.env == "prod" ? "INFO" : "DEBUG"
      }

      # Resource limits
      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      # Persistent volume for data
      volume_mounts {
        name       = "qdrant-storage"
        mount_path = "/qdrant/storage"
      }

      # Startup probe
      startup_probe {
        http_get {
          path = "/readyz"
          port = 6333
        }
        initial_delay_seconds = 10
        period_seconds        = 3
        timeout_seconds       = 2
        failure_threshold     = 10
      }

      # Liveness probe
      liveness_probe {
        http_get {
          path = "/healthz"
          port = 6333
        }
        period_seconds    = 10
        timeout_seconds   = 3
        failure_threshold = 3
      }
    }

    volumes {
      name = "qdrant-storage"
      nfs {
        server    = google_filestore_instance.qdrant_data.networks[0].ip_addresses[0]
        path      = "/${google_filestore_instance.qdrant_data.file_shares[0].name}"
        read_only = false
      }
    }
  }

  labels = var.labels

  depends_on = [
    google_filestore_instance.qdrant_data
  ]
}

# Filestore instance for persistent data
resource "google_filestore_instance" "qdrant_data" {
  name     = "qdrant-data-${var.env}"
  location = var.region
  tier     = var.env == "prod" ? "BASIC_SSD" : "BASIC_HDD"
  project  = var.project_id

  file_shares {
    capacity_gb = var.storage_size_gb
    name        = "qdrant"
  }

  networks {
    network = "default"  # Update if using custom VPC
    modes   = ["MODE_IPV4"]
  }

  labels = var.labels
}

# IAM policy for public access (if needed for development)
resource "google_cloud_run_service_iam_member" "public_access" {
  count = var.env != "prod" ? 1 : 0

  service  = google_cloud_run_v2_service.qdrant.name
  location = google_cloud_run_v2_service.qdrant.location
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "service_url" {
  description = "Qdrant service URL"
  value       = google_cloud_run_v2_service.qdrant.uri
}

output "service_name" {
  description = "Cloud Run service name"
  value       = google_cloud_run_v2_service.qdrant.name
}

output "api_key_secret" {
  description = "Secret Manager secret name for Qdrant API key"
  value       = var.enable_api_key ? google_secret_manager_secret.qdrant_api_key[0].secret_id : null
}

output "backup_bucket" {
  description = "GCS bucket for Qdrant backups"
  value       = google_storage_bucket.qdrant_backups.name
}

output "filestore_ip" {
  description = "Filestore instance IP address"
  value       = google_filestore_instance.qdrant_data.networks[0].ip_addresses[0]
}
