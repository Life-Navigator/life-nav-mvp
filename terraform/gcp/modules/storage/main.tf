# ===========================================================================
# Storage Module - Cloud Storage buckets
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

variable "buckets" {
  description = "List of buckets to create"
  type = list(object({
    name          = string
    location      = string
    storage_class = string
    versioning    = bool
    lifecycle_rules = list(object({
      action = object({
        type          = string
        storage_class = optional(string)
      })
      condition = object({
        age                   = optional(number)
        num_newer_versions    = optional(number)
        with_state            = optional(string)
      })
    }))
  }))
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# Storage Buckets
resource "google_storage_bucket" "buckets" {
  count = length(var.buckets)

  name          = var.buckets[count.index].name
  location      = var.buckets[count.index].location
  storage_class = var.buckets[count.index].storage_class
  project       = var.project_id

  # Uniform bucket-level access
  uniform_bucket_level_access = true

  # Versioning
  versioning {
    enabled = var.buckets[count.index].versioning
  }

  # Lifecycle rules
  dynamic "lifecycle_rule" {
    for_each = var.buckets[count.index].lifecycle_rules
    content {
      action {
        type          = lifecycle_rule.value.action.type
        storage_class = lifecycle_rule.value.action.storage_class
      }
      condition {
        age                   = lifecycle_rule.value.condition.age
        num_newer_versions    = lifecycle_rule.value.condition.num_newer_versions
        with_state           = lifecycle_rule.value.condition.with_state
      }
    }
  }

  # Encryption (use Google-managed keys by default)
  encryption {
    default_kms_key_name = null
  }

  # Labels
  labels = merge(
    var.labels,
    {
      environment = var.env
    }
  )

  # Prevent accidental deletion in prod
  force_destroy = var.env != "prod"
}

# IAM policy for buckets (basic read/write access)
resource "google_storage_bucket_iam_binding" "bucket_admin" {
  count = length(var.buckets)

  bucket = google_storage_bucket.buckets[count.index].name
  role   = "roles/storage.admin"

  members = [
    # Add service accounts here later
  ]
}

# Outputs
output "bucket_names" {
  description = "Map of bucket names"
  value = {
    for idx, bucket in var.buckets :
    split("-", bucket.name)[length(split("-", bucket.name)) - 1] => google_storage_bucket.buckets[idx].name
  }
}

output "bucket_urls" {
  description = "Map of bucket URLs"
  value = {
    for idx, bucket in var.buckets :
    split("-", bucket.name)[length(split("-", bucket.name)) - 1] => google_storage_bucket.buckets[idx].url
  }
}

output "bucket_self_links" {
  description = "List of bucket self links"
  value       = [for bucket in google_storage_bucket.buckets : bucket.self_link]
}
