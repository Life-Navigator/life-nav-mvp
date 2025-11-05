# ===========================================================================
# Secret Manager Module - Secrets management
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "env" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "secrets" {
  description = "List of secrets to create"
  type = list(object({
    name = string
    replication = object({
      automatic = bool
    })
  }))
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# Secret Manager Secrets
resource "google_secret_manager_secret" "secrets" {
  count = length(var.secrets)

  secret_id = "${var.secrets[count.index].name}-${var.env}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = merge(
    var.labels,
    {
      environment = var.env
    }
  )
}

# Outputs
output "secret_ids" {
  description = "Map of secret IDs"
  value = {
    for idx, secret in var.secrets :
    secret.name => google_secret_manager_secret.secrets[idx].id
  }
}

output "secret_names" {
  description = "List of secret names"
  value       = [for secret in google_secret_manager_secret.secrets : secret.secret_id]
}
