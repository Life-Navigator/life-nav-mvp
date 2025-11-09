# ===========================================================================
# GKE Standard Cluster with GPU Support
# Required for Tri-Engine OCR (DeepSeek, PaddleOCR) and ML Workloads
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
  default     = "life-navigator-gpu"
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

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# ===========================================================================
# GKE Standard Cluster (GPU-enabled)
# ===========================================================================

resource "google_container_cluster" "gpu_cluster" {
  provider = google-beta

  name     = "${var.cluster_name}-${var.env}"
  location = var.region
  project  = var.project_id

  # Remove default node pool (we'll create custom ones)
  remove_default_node_pool = true
  initial_node_count       = 1

  # Network configuration
  network    = var.network
  subnetwork = var.subnetwork

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false  # Keep public endpoint for CI/CD
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
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
    channel = "REGULAR"
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
    provider = "PROVIDER_UNSPECIFIED"
  }

  # Dataplane V2 (Cilium)
  datapath_provider = "ADVANCED_DATAPATH"

  # Resource labels
  resource_labels = merge(
    var.labels,
    {
      environment = var.env
      managed_by  = "terraform"
      component   = "gke-gpu-cluster"
    }
  )

  # Deletion protection
  deletion_protection = var.env == "prod" ? true : false
}

# ===========================================================================
# Node Pool: CPU (General workloads)
# ===========================================================================

resource "google_container_node_pool" "cpu_pool" {
  name       = "cpu-pool"
  cluster    = google_container_cluster.gpu_cluster.name
  location   = var.region
  project    = var.project_id

  # Autoscaling configuration
  autoscaling {
    min_node_count = var.env == "prod" ? 3 : 1
    max_node_count = var.env == "prod" ? 10 : 5
  }

  # Node configuration
  node_config {
    machine_type = "n2-standard-4"  # 4 vCPU, 16 GB RAM
    disk_size_gb = 100
    disk_type    = "pd-standard"

    # OAuth scopes
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Metadata
    metadata = {
      disable-legacy-endpoints = "true"
    }

    # Labels
    labels = merge(
      var.labels,
      {
        node-pool   = "cpu"
        environment = var.env
      }
    )

    # Taints (none for CPU pool)
    tags = ["gke-node", "cpu-pool"]
  }

  # Management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }
}

# ===========================================================================
# Node Pool: GPU T4 (OCR + Embeddings)
# ===========================================================================

resource "google_container_node_pool" "gpu_t4_pool" {
  name       = "gpu-t4-pool"
  cluster    = google_container_cluster.gpu_cluster.name
  location   = var.region
  project    = var.project_id

  # Autoscaling configuration
  autoscaling {
    min_node_count = var.env == "prod" ? 2 : 1
    max_node_count = var.env == "prod" ? 5 : 3
  }

  # Node configuration
  node_config {
    machine_type = "n1-standard-8"  # 8 vCPU, 30 GB RAM
    disk_size_gb = 200
    disk_type    = "pd-ssd"

    # GPU configuration
    guest_accelerator {
      type  = "nvidia-tesla-t4"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "DEFAULT"
      }
    }

    # OAuth scopes
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Metadata
    metadata = {
      disable-legacy-endpoints = "true"
    }

    # Labels
    labels = merge(
      var.labels,
      {
        node-pool   = "gpu-t4"
        environment = var.env
        gpu-type    = "nvidia-t4"
      }
    )

    # Taints to ensure only GPU workloads run here
    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }

    tags = ["gke-node", "gpu-pool", "nvidia-t4"]
  }

  # Management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }
}

# ===========================================================================
# Node Pool: High-Memory (Neo4j, Qdrant)
# ===========================================================================

resource "google_container_node_pool" "highmem_pool" {
  name       = "highmem-pool"
  cluster    = google_container_cluster.gpu_cluster.name
  location   = var.region
  project    = var.project_id

  # Autoscaling configuration
  autoscaling {
    min_node_count = 1
    max_node_count = 3
  }

  # Node configuration
  node_config {
    machine_type = "n2-highmem-4"  # 4 vCPU, 32 GB RAM
    disk_size_gb = 200
    disk_type    = "pd-ssd"

    # OAuth scopes
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Metadata
    metadata = {
      disable-legacy-endpoints = "true"
    }

    # Labels
    labels = merge(
      var.labels,
      {
        node-pool   = "highmem"
        environment = var.env
      }
    )

    tags = ["gke-node", "highmem-pool"]
  }

  # Management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }
}

# ===========================================================================
# Outputs
# ===========================================================================

output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.gpu_cluster.name
}

output "cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.gpu_cluster.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "GKE cluster CA certificate"
  value       = google_container_cluster.gpu_cluster.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "cluster_location" {
  description = "GKE cluster location"
  value       = google_container_cluster.gpu_cluster.location
}

output "workload_identity_pool" {
  description = "Workload Identity pool"
  value       = "${var.project_id}.svc.id.goog"
}

output "cpu_pool_name" {
  description = "CPU node pool name"
  value       = google_container_node_pool.cpu_pool.name
}

output "gpu_t4_pool_name" {
  description = "GPU T4 node pool name"
  value       = google_container_node_pool.gpu_t4_pool.name
}

output "highmem_pool_name" {
  description = "High-memory node pool name"
  value       = google_container_node_pool.highmem_pool.name
}
