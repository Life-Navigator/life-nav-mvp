# ===========================================================================
# Cloud Run Job Module - For Batch/Scheduled Workloads
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

variable "job_name" {
  description = "Name of the Cloud Run job"
  type        = string
}

variable "image" {
  description = "Container image to deploy"
  type        = string
}

variable "cpu" {
  description = "CPU allocation (e.g., '1', '2')"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory allocation (e.g., '512Mi', '1Gi')"
  type        = string
  default     = "1Gi"
}

variable "task_count" {
  description = "Number of tasks to run in parallel"
  type        = number
  default     = 1
}

variable "max_retries" {
  description = "Maximum number of retries per task"
  type        = number
  default     = 3
}

variable "timeout_seconds" {
  description = "Task timeout in seconds"
  type        = number
  default     = 600
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
  description = "Service account email for the Cloud Run job"
  type        = string
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

variable "schedule" {
  description = "Cron schedule for the job (optional)"
  type        = string
  default     = null
}

variable "schedule_timezone" {
  description = "Timezone for the schedule"
  type        = string
  default     = "America/New_York"
}

variable "command" {
  description = "Override container command"
  type        = list(string)
  default     = null
}

variable "args" {
  description = "Override container args"
  type        = list(string)
  default     = null
}

# Cloud Run Job
resource "google_cloud_run_v2_job" "job" {
  name     = var.job_name
  location = var.region
  project  = var.project_id

  template {
    task_count = var.task_count

    template {
      service_account = var.service_account
      timeout         = "${var.timeout_seconds}s"
      max_retries     = var.max_retries

      dynamic "vpc_access" {
        for_each = var.vpc_connector != null ? [1] : []
        content {
          connector = var.vpc_connector
          egress    = var.vpc_egress
        }
      }

      containers {
        image = var.image

        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
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
      }
    }
  }

  labels = merge(
    var.labels,
    {
      environment = var.env
      job         = var.job_name
    }
  )

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

# Cloud Scheduler for scheduled jobs
resource "google_cloud_scheduler_job" "scheduler" {
  count = var.schedule != null ? 1 : 0

  name        = "${var.job_name}-scheduler"
  description = "Scheduler for ${var.job_name}"
  schedule    = var.schedule
  time_zone   = var.schedule_timezone
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${var.job_name}:run"

    oauth_token {
      service_account_email = var.service_account
    }
  }

  retry_config {
    retry_count          = 3
    min_backoff_duration = "5s"
    max_backoff_duration = "300s"
    max_doublings        = 5
  }
}

# Outputs
output "job_name" {
  description = "Cloud Run job name"
  value       = google_cloud_run_v2_job.job.name
}

output "job_id" {
  description = "Cloud Run job ID"
  value       = google_cloud_run_v2_job.job.id
}

output "scheduler_name" {
  description = "Cloud Scheduler job name"
  value       = var.schedule != null ? google_cloud_scheduler_job.scheduler[0].name : null
}
