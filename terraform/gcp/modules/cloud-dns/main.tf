# ===========================================================================
# Cloud DNS Module - DNS Zone and Records Management
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "env" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "domain_name" {
  description = "Domain name (e.g., lifenavigator.app)"
  type        = string
}

variable "zone_name" {
  description = "DNS zone name"
  type        = string
  default     = "life-navigator-zone"
}

variable "enable_dnssec" {
  description = "Enable DNSSEC"
  type        = bool
  default     = true
}

variable "cloud_run_services" {
  description = "Map of subdomain to Cloud Run service URLs"
  type        = map(string)
  default     = {}
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# Managed DNS Zone
resource "google_dns_managed_zone" "zone" {
  name        = "${var.zone_name}-${var.env}"
  dns_name    = "${var.domain_name}."
  description = "Life Navigator DNS zone for ${var.env}"
  project     = var.project_id

  visibility = "public"

  dynamic "dnssec_config" {
    for_each = var.enable_dnssec ? [1] : []
    content {
      state         = "on"
      non_existence = "nsec3"
    }
  }

  labels = var.labels
}

# A record for apex domain (if using Load Balancer)
# Note: Cloud Run doesn't support apex domains directly - need Load Balancer
# resource "google_dns_record_set" "apex" {
#   name         = google_dns_managed_zone.zone.dns_name
#   type         = "A"
#   ttl          = 300
#   managed_zone = google_dns_managed_zone.zone.name
#   project      = var.project_id
#   rrdatas      = [var.load_balancer_ip]
# }

# CNAME records for Cloud Run services
resource "google_dns_record_set" "cloud_run" {
  for_each = var.cloud_run_services

  name         = "${each.key}.${google_dns_managed_zone.zone.dns_name}"
  type         = "CNAME"
  ttl          = 300
  managed_zone = google_dns_managed_zone.zone.name
  project      = var.project_id
  rrdatas      = ["ghs.googlehosted.com."]  # Google hosted services CNAME
}

# CAA record for SSL certificate authority authorization
resource "google_dns_record_set" "caa" {
  name         = google_dns_managed_zone.zone.dns_name
  type         = "CAA"
  ttl          = 3600
  managed_zone = google_dns_managed_zone.zone.name
  project      = var.project_id
  rrdatas = [
    "0 issue \"letsencrypt.org\"",
    "0 issue \"pki.goog\"",
    "0 issuewild \"letsencrypt.org\"",
    "0 issuewild \"pki.goog\"",
  ]
}

# MX records (if needed for email)
# resource "google_dns_record_set" "mx" {
#   name         = google_dns_managed_zone.zone.dns_name
#   type         = "MX"
#   ttl          = 3600
#   managed_zone = google_dns_managed_zone.zone.name
#   project      = var.project_id
#   rrdatas = [
#     "1 aspmx.l.google.com.",
#     "5 alt1.aspmx.l.google.com.",
#     "5 alt2.aspmx.l.google.com.",
#   ]
# }

# TXT record for domain verification
resource "google_dns_record_set" "txt" {
  name         = google_dns_managed_zone.zone.dns_name
  type         = "TXT"
  ttl          = 3600
  managed_zone = google_dns_managed_zone.zone.name
  project      = var.project_id
  rrdatas = [
    "\"v=spf1 include:_spf.google.com ~all\"",
  ]
}

# Outputs
output "zone_name" {
  description = "DNS zone name"
  value       = google_dns_managed_zone.zone.name
}

output "name_servers" {
  description = "Name servers for the zone"
  value       = google_dns_managed_zone.zone.name_servers
}

output "dns_name" {
  description = "DNS name"
  value       = google_dns_managed_zone.zone.dns_name
}

output "dnssec_config" {
  description = "DNSSEC configuration"
  value       = var.enable_dnssec ? google_dns_managed_zone.zone.dnssec_config : null
}
