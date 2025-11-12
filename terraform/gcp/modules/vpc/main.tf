# ===========================================================================
# VPC Module - Network infrastructure
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

variable "vpc_name" {
  description = "VPC network name"
  type        = string
}

variable "subnets" {
  description = "List of subnets to create"
  type = list(object({
    name          = string
    ip_cidr_range = string
    region        = string
    secondary_ip_ranges = optional(list(object({
      range_name    = string
      ip_cidr_range = string
    })), [])
  }))
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = var.vpc_name
  auto_create_subnetworks = false
  project                 = var.project_id
}

# Subnets
resource "google_compute_subnetwork" "subnets" {
  count = length(var.subnets)

  name          = "${var.vpc_name}-${var.subnets[count.index].name}"
  ip_cidr_range = var.subnets[count.index].ip_cidr_range
  region        = var.subnets[count.index].region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  # Enable private Google access for managed services
  private_ip_google_access = true

  # Secondary IP ranges for GKE pods and services
  dynamic "secondary_ip_range" {
    for_each = var.subnets[count.index].secondary_ip_ranges
    content {
      range_name    = secondary_ip_range.value.range_name
      ip_cidr_range = secondary_ip_range.value.ip_cidr_range
    }
  }

  # Enable flow logs for dev/staging/prod
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Cloud Router for NAT
resource "google_compute_router" "router" {
  name    = "${var.vpc_name}-router"
  network = google_compute_network.vpc.id
  region  = var.region
  project = var.project_id
}

# Cloud NAT for outbound internet access
resource "google_compute_router_nat" "nat" {
  name                               = "${var.vpc_name}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  project                            = var.project_id

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall Rules - Restrict to specific service ports only
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.vpc_name}-allow-internal"
  network = google_compute_network.vpc.id
  project = var.project_id

  # GKE inter-pod communication (Kubernetes service mesh)
  allow {
    protocol = "tcp"
    ports    = ["8000", "8001", "8080", "8090"]  # Backend, Finance API, Agents, MCP Server
  }

  # Database services
  allow {
    protocol = "tcp"
    ports    = ["5432"]  # Cloud SQL PostgreSQL
  }

  # Caching services
  allow {
    protocol = "tcp"
    ports    = ["6379"]  # Redis
  }

  # Graph databases
  allow {
    protocol = "tcp"
    ports    = ["7687", "7474"]  # Neo4j Bolt + HTTP
  }

  # Vector/semantic stores
  allow {
    protocol = "tcp"
    ports    = ["6333", "6334"]  # Qdrant HTTP + gRPC
  }

  # GraphDB
  allow {
    protocol = "tcp"
    ports    = ["7200"]  # GraphDB SPARQL
  }

  # GraphRAG service
  allow {
    protocol = "tcp"
    ports    = ["50051"]  # gRPC
  }

  # HTTPS for internal services
  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  # DNS
  allow {
    protocol = "udp"
    ports    = ["53"]
  }

  # Health checks and monitoring
  allow {
    protocol = "tcp"
    ports    = ["15021"]  # Istio/Envoy health checks (if using service mesh)
  }

  # ICMP for network diagnostics
  allow {
    protocol = "icmp"
  }

  source_ranges = [for subnet in var.subnets : subnet.ip_cidr_range]

  # Enable logging for security auditing
  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.vpc_name}-allow-ssh"
  network = google_compute_network.vpc.id
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # Restrict to IAP range for secure SSH
  source_ranges = ["35.235.240.0/20"]
}

# Private Service Connection for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.vpc_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# Outputs
output "network_id" {
  description = "VPC network ID"
  value       = google_compute_network.vpc.id
}

output "network_name" {
  description = "VPC network name"
  value       = google_compute_network.vpc.name
}

output "network_self_link" {
  description = "VPC network self link"
  value       = google_compute_network.vpc.self_link
}

output "subnet_ids" {
  description = "Subnet IDs"
  value       = [for subnet in google_compute_subnetwork.subnets : subnet.id]
}

output "subnet_names" {
  description = "Subnet names as map"
  value       = { for subnet in google_compute_subnetwork.subnets : split("-", subnet.name)[length(split("-", subnet.name))-1] => subnet.name }
}

output "subnet_self_links" {
  description = "Subnet self links"
  value       = [for subnet in google_compute_subnetwork.subnets : subnet.self_link]
}
