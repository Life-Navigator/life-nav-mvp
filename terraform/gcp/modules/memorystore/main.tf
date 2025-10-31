# ===========================================================================
# Memorystore Module - Redis cache
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
  description = "Redis instance name"
  type        = string
}

variable "tier" {
  description = "Service tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "BASIC"
}

variable "memory_size_gb" {
  description = "Memory size in GB"
  type        = number
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "REDIS_7_0"
}

variable "authorized_network" {
  description = "VPC network for Redis"
  type        = string
}

variable "reserved_ip_range" {
  description = "Reserved IP range for Redis"
  type        = string
}

variable "redis_configs" {
  description = "Redis configuration parameters"
  type        = map(string)
  default     = {}
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# Memorystore Redis Instance
resource "google_redis_instance" "redis" {
  name           = var.instance_name
  tier           = var.tier
  memory_size_gb = var.memory_size_gb
  region         = var.region
  project        = var.project_id

  redis_version     = var.redis_version
  authorized_network = var.authorized_network
  reserved_ip_range  = var.reserved_ip_range

  # Redis configuration
  redis_configs = var.redis_configs

  # Display name
  display_name = "${var.instance_name} (${var.env})"

  # Enable persistence for prod
  persistence_config {
    persistence_mode = var.env == "prod" ? "RDB" : "DISABLED"
    rdb_snapshot_period = var.env == "prod" ? "TWELVE_HOURS" : null
  }

  # Maintenance policy
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  # Labels
  labels = var.labels
}

# Outputs
output "host" {
  description = "Redis host"
  value       = google_redis_instance.redis.host
}

output "port" {
  description = "Redis port"
  value       = google_redis_instance.redis.port
}

output "current_location_id" {
  description = "Current location ID"
  value       = google_redis_instance.redis.current_location_id
}

output "redis_instance_id" {
  description = "Redis instance ID"
  value       = google_redis_instance.redis.id
}

output "connection_string" {
  description = "Redis connection string"
  value       = "${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
}
