# ===========================================================================
# Artifact Registry Module - Container Image Storage
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

variable "repository_id" {
  description = "Repository ID"
  type        = string
}

variable "description" {
  description = "Repository description"
  type        = string
  default     = "Docker container images"
}

variable "format" {
  description = "Repository format (DOCKER, NPM, etc.)"
  type        = string
  default     = "DOCKER"
}

variable "cleanup_policy_dry_run" {
  description = "Enable dry run for cleanup policies"
  type        = bool
  default     = false
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# Artifact Registry Repository
resource "google_artifact_registry_repository" "repository" {
  project       = var.project_id
  location      = var.region
  repository_id = var.repository_id
  description   = var.description
  format        = var.format

  cleanup_policy_dry_run = var.cleanup_policy_dry_run

  # Cleanup policies to manage storage costs
  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }

  cleanup_policies {
    id     = "keep-tagged-releases"
    action = "KEEP"
    condition {
      tag_state    = "TAGGED"
      tag_prefixes = ["v", "release", "prod", "beta"]
    }
  }

  cleanup_policies {
    id     = "delete-old-dev-images"
    action = "DELETE"
    condition {
      tag_state    = "TAGGED"
      tag_prefixes = ["dev", "pr-", "feature-"]
      older_than   = "1209600s" # 14 days
    }
  }

  labels = merge(
    var.labels,
    {
      environment = var.env
    }
  )
}

# Outputs
output "repository_id" {
  description = "Artifact Registry repository ID"
  value       = google_artifact_registry_repository.repository.repository_id
}

output "repository_name" {
  description = "Artifact Registry repository name"
  value       = google_artifact_registry_repository.repository.name
}

output "repository_url" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repository.repository_id}"
}
