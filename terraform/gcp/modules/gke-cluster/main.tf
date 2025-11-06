# ===========================================================================
# GKE Autopilot Cluster Module
# ===========================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

# ===========================================================================
# Variables
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

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
  default     = "life-navigator-gke"
}

variable "network" {
  description = "VPC network name"
  type        = string
}

variable "subnetwork" {
  description = "VPC subnetwork name"
  type        = string
}

variable "master_ipv4_cidr_block" {
  description = "CIDR block for master network"
  type        = string
  default     = "172.16.0.0/28"
}

variable "enable_private_cluster" {
  description = "Enable private cluster"
  type        = bool
  default     = true
}

variable "enable_private_nodes" {
  description = "Enable private nodes"
  type        = bool
  default     = true
}

variable "master_authorized_networks" {
  description = "List of master authorized networks"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = []
}

variable "release_channel" {
  description = "GKE release channel (RAPID, REGULAR, STABLE)"
  type        = string
  default     = "REGULAR"
}

variable "enable_autopilot" {
  description = "Enable Autopilot mode"
  type        = bool
  default     = true
}

variable "maintenance_window_start_time" {
  description = "Maintenance window start time (RFC3339)"
  type        = string
  default     = "2024-01-01T03:00:00Z"
}

variable "maintenance_window_end_time" {
  description = "Maintenance window end time (RFC3339)"
  type        = string
  default     = "2024-01-01T07:00:00Z"
}

variable "maintenance_window_recurrence" {
  description = "Maintenance window recurrence (RFC5545)"
  type        = string
  default     = "FREQ=WEEKLY;BYDAY=SA"
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# ===========================================================================
# GKE Autopilot Cluster
# ===========================================================================

resource "google_container_cluster" "primary" {
  provider = google-beta

  name     = "${var.cluster_name}-${var.env}"
  location = var.region
  project  = var.project_id

  # Autopilot mode
  enable_autopilot = var.enable_autopilot

  # Network configuration
  network    = var.network
  subnetwork = var.subnetwork

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = var.enable_private_nodes
    enable_private_endpoint = false  # Keep public endpoint for CI/CD
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  # Master authorized networks
  dynamic "master_authorized_networks_config" {
    for_each = length(var.master_authorized_networks) > 0 ? [1] : []
    content {
      dynamic "cidr_blocks" {
        for_each = var.master_authorized_networks
        content {
          cidr_block   = cidr_blocks.value.cidr_block
          display_name = cidr_blocks.value.display_name
        }
      }
    }
  }

  # IP allocation policy for VPC-native networking
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Release channel
  release_channel {
    channel = var.release_channel
  }

  # Maintenance window
  maintenance_policy {
    recurring_window {
      start_time = var.maintenance_window_start_time
      end_time   = var.maintenance_window_end_time
      recurrence = var.maintenance_window_recurrence
    }
  }

  # Addons
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    network_policy_config {
      disabled = false
    }
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
    gcs_fuse_csi_driver_config {
      enabled = true
    }
    config_connector_config {
      enabled = true
    }
  }

  # Binary authorization
  binary_authorization {
    evaluation_mode = var.env == "prod" ? "PROJECT_SINGLETON_POLICY_ENFORCE" : "DISABLED"
  }

  # Monitoring and logging
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
    managed_prometheus {
      enabled = true
    }
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  # Network policy
  network_policy {
    enabled  = true
    provider = "PROVIDER_UNSPECIFIED"  # Uses Dataplane V2
  }

  # Dataplane V2 (Cilium)
  datapath_provider = "ADVANCED_DATAPATH"

  # Security posture
  security_posture_config {
    mode               = var.env == "prod" ? "ENTERPRISE" : "BASIC"
    vulnerability_mode = var.env == "prod" ? "VULNERABILITY_ENTERPRISE" : "VULNERABILITY_BASIC"
  }

  # Notification configuration
  notification_config {
    pubsub {
      enabled = true
      topic   = google_pubsub_topic.cluster_notifications.id
    }
  }

  # Resource labels
  resource_labels = merge(
    var.labels,
    {
      environment = var.env
      managed_by  = "terraform"
      component   = "gke-cluster"
    }
  )

  # Deletion protection
  deletion_protection = var.env == "prod" ? true : false

  # Lifecycle
  lifecycle {
    ignore_changes = [
      # Ignore changes to node pool as Autopilot manages it
      node_pool,
      node_config,
    ]
  }
}

# ===========================================================================
# Pub/Sub Topic for Cluster Notifications
# ===========================================================================

resource "google_pubsub_topic" "cluster_notifications" {
  name    = "${var.cluster_name}-${var.env}-notifications"
  project = var.project_id

  labels = merge(
    var.labels,
    {
      environment = var.env
      managed_by  = "terraform"
    }
  )
}

# ===========================================================================
# Cloud Armor Security Policy
# ===========================================================================

resource "google_compute_security_policy" "ingress_policy" {
  count   = var.env == "prod" ? 1 : 0
  name    = "${var.cluster_name}-${var.env}-ingress-policy"
  project = var.project_id

  # Default rule
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default rule"
  }

  # Rate limiting
  rule {
    action   = "rate_based_ban"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      ban_duration_sec = 600
    }
    description = "Rate limiting rule"
  }

  # Block known bad IPs (example)
  rule {
    action   = "deny(403)"
    priority = "100"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = []  # Add known bad IPs here
      }
    }
    description = "Block known bad IPs"
  }
}

# ===========================================================================
# Outputs
# ===========================================================================

output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "GKE cluster CA certificate"
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "cluster_location" {
  description = "GKE cluster location"
  value       = google_container_cluster.primary.location
}

output "cluster_id" {
  description = "GKE cluster ID"
  value       = google_container_cluster.primary.id
}

output "workload_identity_pool" {
  description = "Workload Identity pool"
  value       = "${var.project_id}.svc.id.goog"
}

output "notification_topic" {
  description = "Pub/Sub topic for cluster notifications"
  value       = google_pubsub_topic.cluster_notifications.name
}

output "security_policy_id" {
  description = "Cloud Armor security policy ID"
  value       = var.env == "prod" ? google_compute_security_policy.ingress_policy[0].id : null
}
