# ===========================================================================
# Cloud Run Service Module - Scale-to-Zero Configuration
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
  description = "Environment (dev/staging/beta/prod)"
  type        = string
}

variable "service_name" {
  description = "Name of the Cloud Run service"
  type        = string
}

variable "image" {
  description = "Container image to deploy"
  type        = string
}

variable "port" {
  description = "Container port"
  type        = number
  default     = 8080
}

variable "cpu" {
  description = "CPU allocation (e.g., '1', '2')"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory allocation (e.g., '512Mi', '1Gi')"
  type        = string
  default     = "512Mi"
}

variable "min_instances" {
  description = "Minimum number of instances (0 for scale-to-zero)"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}

variable "timeout_seconds" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
}

variable "concurrency" {
  description = "Maximum concurrent requests per instance"
  type        = number
  default     = 80
}

variable "env_vars" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Secret environment variables"
  type = list(object({
    name        = string
    secret_name = string
    version     = string
  }))
  default = []
}

variable "vpc_connector" {
  description = "VPC connector for private networking"
  type        = string
  default     = null
}

variable "vpc_egress" {
  description = "VPC egress setting (ALL_TRAFFIC, PRIVATE_RANGES_ONLY)"
  type        = string
  default     = "PRIVATE_RANGES_ONLY"
}

variable "service_account" {
  description = "Service account email for the Cloud Run service"
  type        = string
}

variable "allow_unauthenticated" {
  description = "Allow unauthenticated access"
  type        = bool
  default     = false
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

variable "startup_probe" {
  description = "Startup probe configuration"
  type = object({
    path              = string
    initial_delay     = number
    period            = number
    failure_threshold = number
    timeout           = number
  })
  default = null
}

variable "liveness_probe" {
  description = "Liveness probe configuration"
  type = object({
    path              = string
    period            = number
    failure_threshold = number
    timeout           = number
  })
  default = null
}

# Cloud Run Service
resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.region
  project  = var.project_id

  template {
    service_account = var.service_account

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    dynamic "vpc_access" {
      for_each = var.vpc_connector != null ? [1] : []
      content {
        connector = var.vpc_connector
        egress    = var.vpc_egress
      }
    }

    timeout = "${var.timeout_seconds}s"

    containers {
      image = var.image

      ports {
        container_port = var.port
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = env.value.secret_name
              version = env.value.version
            }
          }
        }
      }

      dynamic "startup_probe" {
        for_each = var.startup_probe != null ? [var.startup_probe] : []
        content {
          http_get {
            path = startup_probe.value.path
            port = var.port
          }
          initial_delay_seconds = startup_probe.value.initial_delay
          period_seconds        = startup_probe.value.period
          failure_threshold     = startup_probe.value.failure_threshold
          timeout_seconds       = startup_probe.value.timeout
        }
      }

      dynamic "liveness_probe" {
        for_each = var.liveness_probe != null ? [var.liveness_probe] : []
        content {
          http_get {
            path = liveness_probe.value.path
            port = var.port
          }
          period_seconds    = liveness_probe.value.period
          failure_threshold = liveness_probe.value.failure_threshold
          timeout_seconds   = liveness_probe.value.timeout
        }
      }
    }
  }

  labels = merge(
    var.labels,
    {
      environment = var.env
      service     = var.service_name
    }
  )

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

# IAM binding for unauthenticated access
resource "google_cloud_run_v2_service_iam_member" "invoker" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "service_name" {
  description = "Cloud Run service name"
  value       = google_cloud_run_v2_service.service.name
}

output "service_uri" {
  description = "Cloud Run service URI"
  value       = google_cloud_run_v2_service.service.uri
}

output "service_id" {
  description = "Cloud Run service ID"
  value       = google_cloud_run_v2_service.service.id
}

output "latest_revision" {
  description = "Latest revision name"
  value       = google_cloud_run_v2_service.service.latest_ready_revision
}
