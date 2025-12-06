# ===========================================================================
# VPC Connector Module - Serverless VPC Access
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

variable "connector_name" {
  description = "Name of the VPC connector"
  type        = string
}

variable "network" {
  description = "VPC network name or self_link"
  type        = string
}

variable "ip_cidr_range" {
  description = "IP CIDR range for the connector (/28 required)"
  type        = string
}

variable "machine_type" {
  description = "Machine type for connector instances"
  type        = string
  default     = "e2-micro"
}

variable "min_instances" {
  description = "Minimum number of connector instances"
  type        = number
  default     = 2
}

variable "max_instances" {
  description = "Maximum number of connector instances"
  type        = number
  default     = 3
}

variable "min_throughput" {
  description = "Minimum throughput in Mbps"
  type        = number
  default     = 200
}

variable "max_throughput" {
  description = "Maximum throughput in Mbps"
  type        = number
  default     = 300
}

variable "labels" {
  description = "Resource labels (note: VPC connector doesn't support labels, kept for consistency)"
  type        = map(string)
  default     = {}
}

# VPC Access Connector
resource "google_vpc_access_connector" "connector" {
  project = var.project_id
  region  = var.region
  name    = var.connector_name

  network       = var.network
  ip_cidr_range = var.ip_cidr_range
  machine_type  = var.machine_type

  min_instances  = var.min_instances
  max_instances  = var.max_instances
  min_throughput = var.min_throughput
  max_throughput = var.max_throughput
}

# Outputs
output "connector_name" {
  description = "VPC connector name"
  value       = google_vpc_access_connector.connector.name
}

output "connector_id" {
  description = "VPC connector ID"
  value       = google_vpc_access_connector.connector.id
}

output "connector_self_link" {
  description = "VPC connector self link"
  value       = google_vpc_access_connector.connector.self_link
}

output "state" {
  description = "VPC connector state"
  value       = google_vpc_access_connector.connector.state
}
